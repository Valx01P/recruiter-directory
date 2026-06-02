#!/usr/bin/env node
/**
 * Headless Codex sector swarm.
 *
 * Codex workers are one-batch exec jobs. The monitor starts the next batch
 * after a worker exits and merges centrally. Sectors progress through coverage,
 * bolster to target, then expansion.
 */

const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const JOB_DIR = path.join(ROOT, "job");
const MANIFEST_FILE = path.join(JOB_DIR, "sectors/manifest.json");
const SWARM_DIR = path.join(JOB_DIR, "swarm");
const LOG_DIR = path.join(SWARM_DIR, "codex-sector-logs");
const SNAPSHOT_DIR = path.join(SWARM_DIR, "codex-sector-snapshots");
const STATE_FILE = path.join(SWARM_DIR, "codex-sector-state.json");
const STOP_REQUEST_FILE = path.join(SWARM_DIR, "codex-sector-stop.json");
const CODEX_BIN = process.env.CODEX_BIN || "codex";
const CODEX_MODEL = process.env.CODEX_SWARM_MODEL || "";
const STARTUP_GRACE_MS = 1200;
const RAW_STOP_WAIT_MS = Number(process.env.CODEX_SECTOR_SWARM_STOP_WAIT_MS || "15000");
const STOP_WAIT_MS = Number.isFinite(RAW_STOP_WAIT_MS) && RAW_STOP_WAIT_MS >= 0 ? RAW_STOP_WAIT_MS : 15000;
const RAW_GRACEFUL_STOP_WAIT_MS = Number(process.env.CODEX_SECTOR_SWARM_GRACEFUL_STOP_WAIT_MS || "600000");
const GRACEFUL_STOP_WAIT_MS = Number.isFinite(RAW_GRACEFUL_STOP_WAIT_MS) && RAW_GRACEFUL_STOP_WAIT_MS >= 0 ? RAW_GRACEFUL_STOP_WAIT_MS : 600000;
const OPTIONS_WITH_VALUES = new Set(["--concurrency", "--wait-ms"]);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error("Missing job/sectors/manifest.json. Run:");
    console.error("  node job/scripts/codex-sector-orchestrator.js init");
    process.exit(1);
  }
  return loadJson(MANIFEST_FILE);
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { sectors: {} };
  return loadJson(STATE_FILE);
}

function saveState(state) {
  fs.mkdirSync(SWARM_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

function loadStopRequest() {
  if (!fs.existsSync(STOP_REQUEST_FILE)) return null;
  try {
    return loadJson(STOP_REQUEST_FILE);
  } catch {
    return { all: true, sectors: [], requestedAt: "unknown", invalid: true };
  }
}

function saveStopRequest(sectors, all) {
  fs.mkdirSync(SWARM_DIR, { recursive: true });
  const request = {
    requestedAt: new Date().toISOString(),
    all: Boolean(all),
    sectors: all ? [] : sectors.map((sector) => sector.key),
  };
  fs.writeFileSync(STOP_REQUEST_FILE, JSON.stringify(request, null, 2) + "\n");
  return request;
}

function clearStopRequest() {
  if (!fs.existsSync(STOP_REQUEST_FILE)) return false;
  fs.rmSync(STOP_REQUEST_FILE, { force: true });
  return true;
}

function snapshotFileFor(sector, batchNumber) {
  return path.join(SNAPSHOT_DIR, `${sector.key}-batch-${String(batchNumber).padStart(4, "0")}.json`);
}

function restoreSnapshot(info, sector) {
  if (!info?.snapshotFile) return false;
  const snapshotFile = path.join(ROOT, info.snapshotFile);
  if (!fs.existsSync(snapshotFile)) return false;
  fs.copyFileSync(snapshotFile, fileForSector(sector));
  return true;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // Detached Codex launches can leave the real worker running after the
    // wrapper exits. Check the process group before treating the worker as done.
    try {
      process.kill(-pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}

function signalWorker(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

function findExternalSectorWorkers(sectors = []) {
  const selected = new Set(sectors.map((sector) => sector.key));
  const workers = new Map();
  let raw = "";
  try {
    raw = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return workers;
  }

  const commandNeedle = `codex --search -a never exec --json -C ${ROOT}`;
  for (const line of raw.split(/\n/)) {
    if (!line.includes(commandNeedle)) continue;
    const sectorMatch = line.match(/Read job\/swarm\/sectors\/([a-z]+)\.md/);
    if (!sectorMatch) continue;
    const sectorKey = sectorMatch[1];
    if (selected.size && !selected.has(sectorKey)) continue;
    const pid = Number(line.trim().split(/\s+/)[0]);
    if (!Number.isFinite(pid) || pid === process.pid) continue;
    if (!workers.has(sectorKey)) workers.set(sectorKey, []);
    workers.get(sectorKey).push(pid);
  }
  return workers;
}

function externalPidCount(workers) {
  let count = 0;
  for (const pids of workers.values()) count += pids.length;
  return count;
}

function fileForSector(sector) {
  return path.join(ROOT, sector.file);
}

function isSouthFloridaCompany(company) {
  return /miami|fort lauderdale|boca raton|west palm beach|coral gables|doral|wynwood|brickell|aventura|hollywood|pompano|delray|south florida/i.test(
    `${company.hq_location || ""} ${company.notes || ""}`
  );
}

function contactTargetForCompany(company) {
  return isSouthFloridaCompany(company) ? 5 : 10;
}

function normalizeIdentity(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|company|co|plc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function hasLinkedInProfileUrl(url) {
  return /(^|\.)linkedin\.com\/(in|pub)\//i.test(String(url || ""));
}

function recruiterNeedsLinkCleanup(recruiter) {
  return String(recruiter.name || "").trim() && !hasLinkedInProfileUrl(recruiter.linkedin_url);
}

function hasOpportunityResearch(company) {
  return [
    company.company_url,
    company.careers_url,
    company.early_career_programs,
    company.application_timeline,
    company.visa_sponsorship,
    company.recent_internship_signal,
    company.opportunity_notes,
  ].some((value) => String(value || "").trim()) || Boolean(company.has_intern_program);
}

function preservationCompanyKeys(company) {
  return [
    `id:${company.id || ""}`,
    `name:${normalizeIdentity(company.name)}`,
  ].filter((key) => !key.endsWith(":"));
}

function companyMapForPreservation(data) {
  const map = new Map();
  for (const company of data?.companies || []) {
    for (const key of preservationCompanyKeys(company)) {
      if (!map.has(key)) map.set(key, company);
    }
  }
  return map;
}

function findPreservedCompany(map, company) {
  return preservationCompanyKeys(company).map((key) => map.get(key)).find(Boolean) || null;
}

function contactPreservationKey(recruiter) {
  const name = normalizeIdentity(recruiter?.name);
  if (name) return `name:${name}`;
  const url = normalizeUrl(recruiter?.linkedin_url);
  if (url) return `url:${url}`;
  const fallback = normalizeIdentity(`${recruiter?.title || ""} ${recruiter?.notes || ""}`);
  return fallback ? `fallback:${fallback}` : "";
}

function contactKeyCounts(recruiters = []) {
  const counts = new Map();
  for (const recruiter of recruiters) {
    const key = contactPreservationKey(recruiter);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function removedExistingContactCount(beforeData, afterData) {
  const afterCompanies = companyMapForPreservation(afterData);
  let removed = 0;

  for (const beforeCompany of beforeData?.companies || []) {
    const afterCompany = findPreservedCompany(afterCompanies, beforeCompany);
    const beforeCounts = contactKeyCounts(beforeCompany.recruiters || []);
    if (!afterCompany) {
      for (const count of beforeCounts.values()) removed += count;
      continue;
    }
    const afterCounts = contactKeyCounts(afterCompany.recruiters || []);
    for (const [key, count] of beforeCounts.entries()) {
      removed += Math.max(0, count - (afterCounts.get(key) || 0));
    }
  }

  return removed;
}

function removedExistingContactCountFromSnapshot(info, sector) {
  if (!info?.snapshotFile) return 0;
  const snapshotFile = path.join(ROOT, info.snapshotFile);
  if (!fs.existsSync(snapshotFile)) return 0;
  try {
    return removedExistingContactCount(loadJson(snapshotFile), loadJson(fileForSector(sector)));
  } catch {
    return 0;
  }
}

function getStats(sector) {
  const data = loadJson(fileForSector(sector));
  const companies = data.companies || [];
  const unpopulated = companies.filter((company) => !(company.recruiters || []).length);
  const missingDescriptions = companies.filter((company) => !String(company.description || "").trim());
  const recruiterLinkCleanup = companies.reduce(
    (sum, company) => sum + (company.recruiters || []).filter(recruiterNeedsLinkCleanup).length,
    0
  );
  const missingOpportunityResearch = companies.filter((company) => !hasOpportunityResearch(company));
  const belowContactTarget = companies.filter((company) => (company.recruiters || []).length < contactTargetForCompany(company));
  const totalRecruiters = companies.reduce((sum, company) => sum + (company.recruiters || []).length, 0);
  const phase = unpopulated.length || missingDescriptions.length
    ? "coverage"
    : recruiterLinkCleanup
      ? "cleanup"
      : missingOpportunityResearch.length
        ? "enrich"
        : belowContactTarget.length
          ? "bolster"
          : "expand";
  return {
    total: companies.length,
    populated: companies.length - unpopulated.length,
    unpopulated: unpopulated.length,
    missingDescriptions: missingDescriptions.length,
    recruiterLinkCleanup,
    missingOpportunityResearch: missingOpportunityResearch.length,
    belowContactTarget: belowContactTarget.length,
    totalRecruiters,
    phase,
  };
}

function selectedSectors(manifest, args) {
  const keys = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (OPTIONS_WITH_VALUES.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("--")) continue;
    keys.push(arg);
  }
  if (keys.length === 0 || keys.includes("all")) return manifest.sectors;

  const byKey = new Map(manifest.sectors.map((sector) => [sector.key, sector]));
  const out = [];
  for (const key of keys) {
    const sector = byKey.get(key);
    if (!sector) {
      console.error(`Unknown sector "${key}". Known sectors: ${manifest.sectors.map((s) => s.key).join(", ")}`);
      process.exit(1);
    }
    out.push(sector);
  }
  return out;
}

function sectorArgs(args) {
  const keys = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (OPTIONS_WITH_VALUES.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("--")) continue;
    keys.push(arg);
  }
  return keys;
}

function selectionIsAll(args) {
  const keys = sectorArgs(args);
  return keys.length === 0 || keys.includes("all");
}

function getConcurrency(args, defaultConcurrency) {
  const idx = args.indexOf("--concurrency");
  const raw = idx === -1 ? process.env.CODEX_SECTOR_SWARM_CONCURRENCY : args[idx + 1];
  const n = Number(raw || defaultConcurrency);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultConcurrency;
}

function getWaitMs(args, defaultWaitMs = STOP_WAIT_MS) {
  const idx = args.indexOf("--wait-ms");
  const raw = idx === -1 ? defaultWaitMs : args[idx + 1];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultWaitMs;
}

function runMerge() {
  execFileSync(process.execPath, [path.join(JOB_DIR, "scripts/merge-recruiter-partitions.js"), "--source", "sectors"], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

function assertCodexLaunchSupported() {
  const args = ["--search", "-a", "never", "exec", "--help"];
  try {
    execFileSync(CODEX_BIN, args, { cwd: ROOT, stdio: "ignore" });
  } catch (err) {
    console.error("Codex swarm cannot launch with the expected CLI flags.");
    console.error(`Tried: ${CODEX_BIN} ${args.join(" ")}`);
    console.error(err.message || err);
    process.exit(1);
  }
}

function getFileFingerprint(sector) {
  const stat = fs.statSync(fileForSector(sector));
  return {
    size: stat.size,
    mtimeMs: Math.round(stat.mtimeMs),
  };
}

function fingerprintChanged(before, after) {
  if (!before || !after) return false;
  return before.size !== after.size || before.mtimeMs !== after.mtimeMs;
}

function statsChanged(before, after) {
  if (!before || !after) return false;
  return [
    "total",
    "populated",
    "unpopulated",
    "missingDescriptions",
    "recruiterLinkCleanup",
    "missingOpportunityResearch",
    "belowContactTarget",
    "totalRecruiters",
    "phase",
  ].some((key) => before[key] !== after[key]);
}

function readTail(file, maxBytes = 20000) {
  if (!file || !fs.existsSync(file)) return "";
  const stat = fs.statSync(file);
  const length = Math.min(stat.size, maxBytes);
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, stat.size - length);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function summarizeLogIssue(logFile) {
  const text = readTail(logFile);
  if (!text.trim()) return "";
  const lines = text.split(/\r?\n/).filter(Boolean).slice(-80).reverse();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{")) {
      try {
        const event = JSON.parse(trimmed);
        const message = event.message || event.error || event.msg || "";
        if (message && /error|fatal|failed|permission|approval|sandbox/i.test(String(message))) {
          return String(message).slice(0, 180);
        }
        continue;
      } catch {
        // Ignore partial JSONL lines from an active writer.
      }
    }
    if (/^(error|fatal):/i.test(trimmed) || /unexpected argument|permission denied|approval|sandbox|failed/i.test(trimmed)) {
      return trimmed.slice(0, 180);
    }
  }
  return "";
}

function hasCompletionMarker(logFile, sectorKey) {
  return readTail(logFile, 50000).includes(`SECTOR_BATCH_COMPLETE ${sectorKey}`);
}

function truncate(s, max = 95) {
  const oneLine = String(s || "").replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}...` : oneLine;
}

function buildPrompt(sector, stats, batchNumber) {
  const instructionFile = `job/swarm/sectors/${sector.key}.md`;
  const marker = `=== SECTOR_BATCH_COMPLETE ${sector.key} <companies-touched> <entries-added> <remaining-unpopulated> <remaining-missing-descriptions> ===`;
  return `You are a headless Codex worker in the recruiter directory sector swarm.

Read ${instructionFile} first and follow it exactly.

Live state for this sector:
- Sector: ${sector.label} (${sector.key})
- Working file: ${sector.file}
- Batch number for this sector: ${batchNumber}
- Current phase: ${stats.phase}
- Companies: ${stats.total}
- Populated companies: ${stats.populated}
- Empty recruiter arrays remaining: ${stats.unpopulated}
- Missing company descriptions remaining: ${stats.missingDescriptions}
- Contacts needing LinkedIn profile URL cleanup: ${stats.recruiterLinkCleanup}
- Companies missing internship/opportunity research: ${stats.missingOpportunityResearch}
- Existing companies below contact target: ${stats.belowContactTarget}
- Total recruiters in this sector file: ${stats.totalRecruiters}

Do exactly one batch, then stop. Edit only ${sector.file}. Do not edit canonical JSON, UI copies, other sector files, or shared docs. Do not run the merge script; the orchestrator will merge after you exit.

Stop coordination:
- The orchestrator may create job/swarm/codex-sector-stop.json while you are running.
- Before starting each new company search and before writing JSON, check that file. If it exists and either has "all": true or includes "${sector.key}" in "sectors", finish only the company/contact record already in progress, validate the JSON, run the final status command, print the completion marker, and exit.
- Do not save a partial recruiter/contact. Keep a candidate out of recruiters[] until name, title or clear role, and a verified linkedin_url are all known.
- If you cannot verify a LinkedIn profile URL for a new person, do not add that new person as a recruiter/contact. For existing contacts, preserve the record and add a concise verification-pending note instead of deleting it.

Phase behavior:
- coverage: finish missing descriptions first, then fill any empty recruiters[] arrays, preserving existing recruiter data.
- cleanup: before adding new contacts or companies, repair existing recruiter/contact entries whose linkedin_url is missing or is not a person profile URL. Search for the person's current public LinkedIn profile and fill it when verified. If no credible profile URL can be verified, keep the existing contact, add a concise verification-pending note, and move on. Do not delete existing contacts or shrink recruiters[] during cleanup; questionable pruning belongs in a separate human-reviewed pass.
- enrich: before expanding, add company-level research fields for internship/search usefulness: company_url, careers_url, early_career_programs, application_timeline, visa_sponsorship, recent_internship_signal, opportunity_notes, and has_intern_program when supported by public evidence.
- bolster: add recruiters or technical hiring members to companies below their contact target. Stop at 5 contacts for smaller Miami / South Florida startup teams, and 10 contacts for medium/larger companies elsewhere. If recruiter searches are thin, use founders, CTOs, VPs/Heads of Engineering, engineering managers, product/AI/data/security leads, or other technical staff who are visibly hiring or leading teams, but only when their LinkedIn profile URL is verified.
- expand: when descriptions, link cleanup, enrichment, and bolstering are no longer yielding easy improvements, add 3-8 new ${sector.label} companies. Prioritize smaller Miami / South Florida startups and small businesses with technical hiring signals, then San Jose / Silicon Valley startups. Reserve IDs with node job/scripts/allocate-company-ids.js before adding.

Expansion focus:
- Prefer Miami, Fort Lauderdale, Boca Raton, West Palm Beach, Coral Gables, Doral, Wynwood, Brickell, and nearby South Florida startup/industrial hubs.
- For construction, industrial, logistics, energy, proptech, hardware, defense, healthcare, fintech, AI, cloud, and cybersecurity sectors, look for small local operators with real software, data, engineering, operations, product, or technical hiring needs.
- For those smaller Miami / South Florida startup entries, 5 good contacts is enough. For medium-sized companies elsewhere in the United States, keep the 10-contact maximum target.
- Avoid duplicating companies already present in any sector file or canonical JSON. Search exact names and LinkedIn company URLs before adding.
- For both existing and new companies, collect opportunity research that helps internship outreach: named student/new-grad programs, likely application timing, visa/work-authorization notes from public pages, evidence of recent interns/new grads, careers URL, company URL, and a concise opportunity_notes summary.

Use live web search for public verification. Preserve existing good data. When the batch is done, run the status command from ${instructionFile}, print the marker exactly on its own line:

${marker}

Then exit.`;
}

function launchSector(sector, state, stats = getStats(sector)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const info = state.sectors[sector.key] || {};
  const batchNumber = (info.batchNumber || 0) + 1;
  const prompt = buildPrompt(sector, stats, batchNumber);
  const promptFile = path.join(LOG_DIR, `${sector.key}-batch-${String(batchNumber).padStart(4, "0")}-prompt.txt`);
  const logFile = path.join(LOG_DIR, `${sector.key}.jsonl`);
  const snapshotFile = snapshotFileFor(sector, batchNumber);
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.copyFileSync(fileForSector(sector), snapshotFile);
  fs.writeFileSync(promptFile, prompt, "utf8");

  const args = ["--search", "-a", "never"];
  if (CODEX_MODEL) args.push("-m", CODEX_MODEL);
  args.push("exec", "--json", "-C", ROOT, "-s", "workspace-write", prompt);

  const logFd = fs.openSync(logFile, "a");
  const child = spawn(CODEX_BIN, args, {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  fs.closeSync(logFd);
  child.unref();

  state.sectors[sector.key] = {
    pid: child.pid,
    batchNumber,
    launchedAt: new Date().toISOString(),
    promptFile: path.relative(ROOT, promptFile),
    logFile: path.relative(ROOT, logFile),
    snapshotFile: path.relative(ROOT, snapshotFile),
    current: stats,
    fingerprint: getFileFingerprint(sector),
    lastError: "",
    lastWarning: "",
  };
  console.log(`  launched ${sector.key.padEnd(10)} pid ${child.pid} | phase:${stats.phase} unpop:${stats.unpopulated} desc:${stats.missingDescriptions} links:${stats.recruiterLinkCleanup} enrich:${stats.missingOpportunityResearch} underTarget:${stats.belowContactTarget}`);
  return true;
}

function stopAppliesToSector(stopRequest, sector) {
  if (!stopRequest) return false;
  if (stopRequest.all) return true;
  return Array.isArray(stopRequest.sectors) && stopRequest.sectors.includes(sector.key);
}

function countAlive(state, sectors, externalWorkers = findExternalSectorWorkers(sectors)) {
  return sectors.filter((sector) => (
    isAlive(state.sectors[sector.key]?.pid) || (externalWorkers.get(sector.key) || []).length > 0
  )).length;
}

function workPriority(stats) {
  if (stats.unpopulated > 0) return 0;
  if (stats.missingDescriptions > 0) return 1;
  if (stats.recruiterLinkCleanup > 0) return 2;
  if (stats.missingOpportunityResearch > 0) return 3;
  if (stats.belowContactTarget > 0) return 4;
  return 5;
}

function workNeed(stats) {
  if (stats.unpopulated > 0) return stats.unpopulated;
  if (stats.missingDescriptions > 0) return stats.missingDescriptions;
  if (stats.recruiterLinkCleanup > 0) return stats.recruiterLinkCleanup;
  if (stats.missingOpportunityResearch > 0) return stats.missingOpportunityResearch;
  if (stats.belowContactTarget > 0) return stats.belowContactTarget;
  return stats.total;
}

function priorityLabel(stats) {
  if (stats.unpopulated > 0) return "empty";
  if (stats.missingDescriptions > 0) return "desc";
  if (stats.recruiterLinkCleanup > 0) return "links";
  if (stats.missingOpportunityResearch > 0) return "enrich";
  if (stats.belowContactTarget > 0) return "underTarget";
  return "expand";
}

function launchCandidates(sectors, state, stopRequest = null, externalWorkers = findExternalSectorWorkers(sectors)) {
  return sectors
    .map((sector, order) => {
      if (stopAppliesToSector(stopRequest, sector)) return null;
      const info = state.sectors[sector.key] || {};
      if (info.pid && isAlive(info.pid)) return null;
      if ((externalWorkers.get(sector.key) || []).length > 0) return null;
      const stats = getStats(sector);
      return {
        sector,
        stats,
        order,
        priority: workPriority(stats),
        need: workNeed(stats),
        batchNumber: info.batchNumber || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      a.priority - b.priority ||
      (a.batchNumber === 0 ? 0 : 1) - (b.batchNumber === 0 ? 0 : 1) ||
      b.need - a.need ||
      a.batchNumber - b.batchNumber ||
      a.order - b.order
    ));
}

function launchToConcurrency(sectors, state, concurrency, stopRequest = null) {
  const externalWorkers = findExternalSectorWorkers(sectors);
  let alive = countAlive(state, sectors, externalWorkers);
  let launched = 0;
  for (const candidate of launchCandidates(sectors, state, stopRequest, externalWorkers)) {
    if (alive >= concurrency) break;
    if (launchSector(candidate.sector, state, candidate.stats)) {
      alive++;
      launched++;
    }
  }
  return launched;
}

function recordExitedSector(sector, state) {
  const info = state.sectors[sector.key];
  if (!info?.pid || isAlive(info.pid)) return null;

  const now = new Date().toISOString();
  const logFile = info.logFile ? path.join(ROOT, info.logFile) : "";
  const issue = summarizeLogIssue(logFile);
  const completed = hasCompletionMarker(logFile, sector.key);
  let afterStats = null;
  let afterFingerprint = null;

  try {
    afterStats = getStats(sector);
    afterFingerprint = getFileFingerprint(sector);
  } catch (err) {
    info.lastError = `Could not read ${sector.file} after exit: ${err.message || err}`;
  }

  const warnings = [];
  const recruiterDrop = (info.current?.totalRecruiters || 0) - (afterStats?.totalRecruiters || 0);
  const removedContacts = removedExistingContactCountFromSnapshot(info, sector);
  if (recruiterDrop > 0 || removedContacts > 0) {
    if (recruiterDrop > 0) {
      warnings.push(`Recruiter/contact count dropped by ${recruiterDrop} in batch ${info.batchNumber || "?"}`);
    }
    if (removedContacts > 0) {
      warnings.push(`Existing contact identity disappeared for ${removedContacts} contact(s) in batch ${info.batchNumber || "?"}`);
    }
    if (restoreSnapshot(info, sector)) {
      warnings.push("rolled back sector file to pre-batch snapshot");
      try {
        afterStats = getStats(sector);
        afterFingerprint = getFileFingerprint(sector);
      } catch (err) {
        info.lastError = `Could not read ${sector.file} after rollback: ${err.message || err}`;
      }
    } else {
      warnings.push("no pre-batch snapshot was available for rollback");
    }
  }

  const progressed = statsChanged(info.current, afterStats) || fingerprintChanged(info.fingerprint, afterFingerprint);
  info.pid = null;
  info.lastExitAt = now;
  info.lastStats = afterStats || info.lastStats;
  info.lastCompletedAt = completed ? now : info.lastCompletedAt;

  if (progressed) {
    info.lastProgressAt = now;
    info.noProgressCount = 0;
  } else {
    info.noProgressCount = (info.noProgressCount || 0) + 1;
    warnings.push(`No file/stat progress detected for batch ${info.batchNumber || "?"}`);
  }

  if (!completed) {
    warnings.push(`Worker exited before SECTOR_BATCH_COMPLETE marker for batch ${info.batchNumber || "?"}`);
  }

  info.lastWarning = warnings.join("; ");

  if (issue && !completed) {
    info.lastError = issue;
  } else if (progressed && completed) {
    info.lastError = "";
  }

  return { progressed, issue: info.lastError || info.lastWarning || "", completed };
}

function refreshExitedWorkers(sectors, state, { log = false } = {}) {
  let changed = false;
  let mergeNeeded = false;
  const externalWorkers = findExternalSectorWorkers(sectors);

  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    if (!info?.pid || isAlive(info.pid)) continue;
    if ((externalWorkers.get(sector.key) || []).length > 0) continue;
    const result = recordExitedSector(sector, state);
    changed = true;
    mergeNeeded = true;
    if (log) {
      const progress = result?.progressed ? "progress" : "no progress";
      const issue = result?.issue ? ` | ${truncate(result.issue)}` : "";
      console.log(`[${new Date().toISOString().slice(11, 19)}] ${sector.key} batch ${info.batchNumber || "?"} exited (${progress})${issue}`);
    }
  }

  return { changed, mergeNeeded };
}

function reconcileIdleSectorStats(sectors, state) {
  let changed = false;
  const now = new Date().toISOString();

  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    if (!info || info.pid) continue;

    let stats = null;
    try {
      stats = getStats(sector);
    } catch {
      continue;
    }

    if (!statsChanged(info.lastStats || info.current, stats)) continue;
    info.lastStats = stats;
    info.lastProgressAt = now;
    info.lastWarning = "";
    info.lastError = "";
    changed = true;
  }

  return changed;
}

function cmdInit() {
  clearStopRequest();
  execFileSync(process.execPath, [path.join(JOB_DIR, "scripts/build-sector-partitions.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  execFileSync(process.execPath, [path.join(JOB_DIR, "scripts/generate-sector-instructions.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  runMerge();
}

function cmdStart(args) {
  const manifest = loadManifest();
  const sectors = selectedSectors(manifest, args);
  const concurrency = getConcurrency(args, sectors.length);
  const state = loadState();
  assertCodexLaunchSupported();
  const clearedStop = clearStopRequest();

  console.log(`=== Starting Codex sector swarm (${sectors.length} sectors, concurrency ${concurrency}) ===`);
  console.log("Default behavior is one worker per selected sector.\n");
  if (clearedStop) console.log(`Cleared ${path.relative(ROOT, STOP_REQUEST_FILE)} before starting new workers.\n`);

  const refreshed = refreshExitedWorkers(sectors, state, { log: true });
  const launched = launchToConcurrency(sectors, state, concurrency);
  sleep(STARTUP_GRACE_MS);
  const early = refreshExitedWorkers(sectors, state, { log: true });

  saveState(state);
  if (launched === 0 && countAlive(state, sectors) >= concurrency) {
    console.log(`\nNo new workers launched; ${countAlive(state, sectors)} already running.`);
  }
  console.log(`\nState: ${path.relative(ROOT, STATE_FILE)}`);
  console.log(`Logs:  ${path.relative(ROOT, LOG_DIR)}`);
  if (early.mergeNeeded || refreshed.mergeNeeded) {
    console.log("One or more workers had exited. Run `node job/scripts/codex-sector-orchestrator.js merge` if you want an immediate merge.");
  }
  console.log("\nCurrent status:");
  printStatus(sectors, state);
  console.log("\nRun `node job/scripts/codex-sector-orchestrator.js monitor` to keep batches moving.");
}

function printStatus(sectors, state) {
  console.log("=== Codex Sector Swarm Status ===\n");
  const stopRequest = loadStopRequest();
  const externalWorkers = findExternalSectorWorkers(sectors);
  let total = 0;
  let unpop = 0;
  let missing = 0;
  let linkCleanup = 0;
  let enrichMissing = 0;
  let below10 = 0;
  let recruiters = 0;

  for (const sector of sectors) {
    const stats = getStats(sector);
    const info = state.sectors[sector.key] || {};
    const externalPids = externalWorkers.get(sector.key) || [];
    const alive = isAlive(info.pid) || externalPids.length > 0;
    total += stats.total;
    unpop += stats.unpopulated;
    missing += stats.missingDescriptions;
    linkCleanup += stats.recruiterLinkCleanup;
    enrichMissing += stats.missingOpportunityResearch;
    below10 += stats.belowContactTarget;
    recruiters += stats.totalRecruiters;
    const pct = stats.total ? ((stats.populated / stats.total) * 100).toFixed(1) : "0.0";
    let lastIssue = info.lastError || info.lastWarning || "";
    if (String(lastIssue || "").trim().startsWith("{")) {
      lastIssue = info.lastWarning || "";
    }
    const issueText = lastIssue ? ` issue:${truncate(lastIssue, 80)}` : "";
    console.log(
      `${sector.key.padEnd(10)} ${String(stats.populated).padStart(4)}/${String(stats.total).padEnd(4)} (${pct.padStart(5)}%) phase:${stats.phase.padEnd(8)} ` +
      `unpop:${String(stats.unpopulated).padStart(4)} desc:${String(stats.missingDescriptions).padStart(4)} ` +
      `links:${String(stats.recruiterLinkCleanup).padStart(5)} enrich:${String(stats.missingOpportunityResearch).padStart(4)} ` +
      `underTarget:${String(stats.belowContactTarget).padStart(4)} recs:${String(stats.totalRecruiters).padStart(5)} ` +
      `alive:${alive ? "yes" : "no "} batch:${String(info.batchNumber || 0).padStart(3)} next:${priorityLabel(stats).padEnd(7)}${externalPids.length ? ` pids:${externalPids.join(",")}` : ""}${issueText}`
    );
  }

  console.log(`\nTotals: ${total} companies | ${unpop} empty recruiter arrays | ${missing} missing descriptions | ${linkCleanup} contacts needing profile URLs | ${enrichMissing} missing opportunity research | ${below10} below contact target | ${recruiters} recruiters`);

  const stopped = sectors.filter((sector) => stopAppliesToSector(stopRequest, sector));
  if (stopped.length) {
    const scope = stopRequest?.all ? "all sectors" : stopped.map((sector) => sector.key).join(", ");
    console.log(`Stop requested for ${scope}; monitor/start will not launch new matching workers until start/init clears it.`);
  }

  const next = launchCandidates(sectors, state, stopRequest, externalWorkers).slice(0, sectors.length).map(({ sector, stats }) => (
    `${sector.key}:${priorityLabel(stats)}(${workNeed(stats)})`
  ));
  if (next.length) console.log(`Next launch order: ${next.join(", ")}`);
}

function cmdStatus(args) {
  const manifest = loadManifest();
  const sectors = selectedSectors(manifest, args);
  const state = loadState();
  const refreshed = refreshExitedWorkers(sectors, state);
  const reconciled = reconcileIdleSectorStats(sectors, state);
  if (refreshed.changed || reconciled) saveState(state);
  printStatus(sectors, state);
}

function cmdStop(args) {
  const manifest = loadManifest();
  const sectors = selectedSectors(manifest, args);
  const state = loadState();
  const externalWorkers = findExternalSectorWorkers(sectors);
  const force = args.includes("--force") || args.includes("--now");
  const waitMs = getWaitMs(args, force ? STOP_WAIT_MS : GRACEFUL_STOP_WAIT_MS);
  const mergeAfterStop = !force && !args.includes("--no-merge");
  const all = selectionIsAll(args);

  console.log(force ? "=== Force stopping Codex sector workers ===\n" : "=== Gracefully stopping Codex sector workers ===\n");
  if (force) {
    console.log("  force stop does not merge; run `merge` manually after reviewing sector status");
  }
  if (!force) {
    const request = saveStopRequest(sectors, all);
    const scope = request.all ? "all sectors" : request.sectors.join(", ");
    console.log(`  stop requested for ${scope}`);
    console.log("  active workers will finish their current batch/checkpoint, validate JSON, print the marker, and exit");
  }

  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    if (!info?.pid) continue;
    if (!isAlive(info.pid)) {
      info.pid = null;
      console.log(`  ${sector.key}: not running`);
      continue;
    }
    if (!force) {
      console.log(`  ${sector.key}: waiting for pid ${info.pid} to finish`);
      continue;
    }
    try {
      if (!signalWorker(info.pid, "SIGTERM")) throw new Error("signal failed");
      console.log(`  ${sector.key}: sent SIGTERM to process group ${info.pid}`);
    } catch {
      console.log(`  ${sector.key}: already stopped`);
      info.pid = null;
    }
  }

  for (const sector of sectors) {
    const pids = externalWorkers.get(sector.key) || [];
    if (!pids.length) continue;
    if (!force) {
      console.log(`  ${sector.key}: waiting for detached worker pid(s) ${pids.join(", ")}`);
      continue;
    }
    for (const pid of pids) {
      if (signalWorker(pid, "SIGTERM")) {
        console.log(`  ${sector.key}: sent SIGTERM to detached worker pid ${pid}`);
      }
    }
  }

  const started = Date.now();
  while (Date.now() - started < waitMs) {
    const external = findExternalSectorWorkers(sectors);
    const stillAlive = sectors.filter((sector) => (
      isAlive(state.sectors[sector.key]?.pid) || (external.get(sector.key) || []).length > 0
    ));
    if (stillAlive.length === 0) break;
    sleep(500);
  }

  let aliveAfterStop = 0;
  const externalAfterStop = findExternalSectorWorkers(sectors);
  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    const externalPids = externalAfterStop.get(sector.key) || [];
    if (externalPids.length && !info?.pid) {
      aliveAfterStop++;
      if (info) {
        info.lastWarning = force
          ? `Force stop requested, but detached worker pid(s) ${externalPids.join(", ")} were still alive after ${waitMs}ms`
          : `Graceful stop requested, but detached worker pid(s) ${externalPids.join(", ")} were still finishing after ${waitMs}ms`;
      }
      continue;
    }
    if (!info?.pid) continue;
    if (isAlive(info.pid) || externalPids.length) {
      aliveAfterStop++;
      info.lastWarning = force
        ? `Force stop requested, but pid ${info.pid} was still alive after ${waitMs}ms`
        : `Graceful stop requested, but pid ${info.pid} was still finishing after ${waitMs}ms`;
      continue;
    }
    recordExitedSector(sector, state);
  }

  saveState(state);

  if (aliveAfterStop === 0) {
    clearStopRequest();
    if (mergeAfterStop) {
      console.log("\nMerging sector files into canonical/UI JSON...");
      runMerge();
    }
  } else if (mergeAfterStop) {
    console.log(`\nSkipped merge because ${aliveAfterStop} worker(s) are still alive.`);
    if (!force) {
      console.log("Run `node job/scripts/codex-sector-orchestrator.js stop` again, or leave `monitor` running, after they finish.");
    }
  }
}

function cmdMonitor(args) {
  const manifest = loadManifest();
  const sectors = selectedSectors(manifest, args);
  const concurrency = getConcurrency(args, sectors.length);
  const state = loadState();
  assertCodexLaunchSupported();

  console.log(`=== Codex Sector Monitor (concurrency ${concurrency}) ===`);
  console.log("Ctrl-C stops the monitor only; workers continue until `stop` is run.\n");

  const tick = () => {
    let changed = false;
    const stopRequest = loadStopRequest();
    const refreshed = refreshExitedWorkers(sectors, state, { log: true });
    changed = changed || refreshed.changed;

    if (refreshed.mergeNeeded) {
      try {
        runMerge();
      } catch (err) {
        console.error("Merge failed, likely due to a worker writing JSON right now. Will retry on next tick.");
        console.error(err.message || err);
      }
    }

    let launched = 0;
    if (!stopRequest) {
      launched = launchToConcurrency(sectors, state, concurrency);
    }
    if (launched) changed = true;

    const totals = sectors.reduce((acc, sector) => {
      const stats = getStats(sector);
      acc.unpop += stats.unpopulated;
      acc.missing += stats.missingDescriptions;
      acc.links += stats.recruiterLinkCleanup;
      acc.enrich += stats.missingOpportunityResearch;
      acc.underTarget += stats.belowContactTarget;
      acc.expand += stats.phase === "expand" ? 1 : 0;
      return acc;
    }, { unpop: 0, missing: 0, links: 0, enrich: 0, underTarget: 0, expand: 0 });

    const alive = countAlive(state, sectors);
    const stopText = stopRequest ? " stop:requested" : "";
    process.stdout.write(
      `\r[${new Date().toISOString().slice(11, 19)}] alive:${alive} expand:${totals.expand}/${sectors.length} unpop:${totals.unpop} desc:${totals.missing} links:${totals.links} enrich:${totals.enrich} underTarget:${totals.underTarget}${stopText}   `
    );

    if (stopRequest && alive === 0) {
      clearStopRequest();
      if (changed) saveState(state);
      console.log("\nStop request complete; no workers remain alive.");
      process.exit(0);
    }

    if (changed) saveState(state);
  };

  tick();
  const interval = setInterval(tick, 60 * 1000);
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\nMonitor stopped. Workers are not killed; use `stop` if needed.");
    process.exit(0);
  });
}

function help() {
  console.log(`
Codex Sector Recruiter Swarm

Commands:
  init                         Build sector partitions, generate instructions, merge once
  start [sectors...]           Launch Codex workers and print status
  monitor [sectors...]         Relaunch workers through coverage, bolster, and expansion
  status [sectors...]          Show sector progress
  stop [sectors...]            Gracefully stop workers, then merge sector files by default
  merge                        Merge sector files into canonical/UI JSON

Options:
  --concurrency N              Max simultaneous Codex workers (default: one per selected sector)
  --wait-ms N                  Stop wait timeout (default graceful: 600000, force: 15000)
  --no-merge                   Gracefully stop workers without the default merge
  --force, --now               Interrupt workers immediately with SIGTERM and do not merge

Examples:
  node job/scripts/codex-sector-orchestrator.js init
  node job/scripts/codex-sector-orchestrator.js start
  node job/scripts/codex-sector-orchestrator.js monitor
  node job/scripts/codex-sector-orchestrator.js stop
  node job/scripts/codex-sector-orchestrator.js status cyber ai cloud

Environment:
  CODEX_BIN=/path/to/codex
  CODEX_SWARM_MODEL=<model>
  CODEX_SECTOR_SWARM_CONCURRENCY=<override default concurrency>
  CODEX_SECTOR_SWARM_GRACEFUL_STOP_WAIT_MS=600000
  CODEX_SECTOR_SWARM_STOP_WAIT_MS=15000
`);
}

function main() {
  const [cmd = "help", ...args] = process.argv.slice(2);
  if (cmd === "init") return cmdInit();
  if (cmd === "start") return cmdStart(args);
  if (cmd === "monitor") return cmdMonitor(args);
  if (cmd === "status") return cmdStatus(args);
  if (cmd === "stop") return cmdStop(args);
  if (cmd === "merge") return runMerge();
  return help();
}

main();
