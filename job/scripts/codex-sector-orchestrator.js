#!/usr/bin/env node
/**
 * Headless Codex sector swarm.
 *
 * Codex workers are one-batch exec jobs. The monitor starts the next batch
 * after a worker exits and merges centrally. Sectors progress through coverage,
 * bolster-to-10, then expansion.
 */

const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const JOB_DIR = path.join(ROOT, "job");
const MANIFEST_FILE = path.join(JOB_DIR, "sectors/manifest.json");
const SWARM_DIR = path.join(JOB_DIR, "swarm");
const LOG_DIR = path.join(SWARM_DIR, "codex-sector-logs");
const STATE_FILE = path.join(SWARM_DIR, "codex-sector-state.json");
const CODEX_BIN = process.env.CODEX_BIN || "codex";
const CODEX_MODEL = process.env.CODEX_SWARM_MODEL || "";
const STARTUP_GRACE_MS = 1200;
const RAW_STOP_WAIT_MS = Number(process.env.CODEX_SECTOR_SWARM_STOP_WAIT_MS || "15000");
const STOP_WAIT_MS = Number.isFinite(RAW_STOP_WAIT_MS) && RAW_STOP_WAIT_MS >= 0 ? RAW_STOP_WAIT_MS : 15000;
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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function fileForSector(sector) {
  return path.join(ROOT, sector.file);
}

function getStats(sector) {
  const data = loadJson(fileForSector(sector));
  const companies = data.companies || [];
  const unpopulated = companies.filter((company) => !(company.recruiters || []).length);
  const missingDescriptions = companies.filter((company) => !String(company.description || "").trim());
  const belowContactTarget = companies.filter((company) => (company.recruiters || []).length < 10);
  const totalRecruiters = companies.reduce((sum, company) => sum + (company.recruiters || []).length, 0);
  const phase = unpopulated.length || missingDescriptions.length
    ? "coverage"
    : belowContactTarget.length
      ? "bolster"
      : "expand";
  return {
    total: companies.length,
    populated: companies.length - unpopulated.length,
    unpopulated: unpopulated.length,
    missingDescriptions: missingDescriptions.length,
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

function getConcurrency(args, defaultConcurrency) {
  const idx = args.indexOf("--concurrency");
  const raw = idx === -1 ? process.env.CODEX_SECTOR_SWARM_CONCURRENCY : args[idx + 1];
  const n = Number(raw || defaultConcurrency);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultConcurrency;
}

function getWaitMs(args) {
  const idx = args.indexOf("--wait-ms");
  const raw = idx === -1 ? STOP_WAIT_MS : args[idx + 1];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : STOP_WAIT_MS;
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
- Existing companies below 10 contacts: ${stats.belowContactTarget}
- Total recruiters in this sector file: ${stats.totalRecruiters}

Do exactly one batch, then stop. Edit only ${sector.file}. Do not edit canonical JSON, UI copies, other sector files, or shared docs. Do not run the merge script; the orchestrator will merge after you exit.

Phase behavior:
- coverage: finish missing descriptions first, then fill any empty recruiters[] arrays, preserving existing recruiter data.
- bolster: add recruiters or technical hiring members to companies with fewer than 10 contacts. Stop at 10 contacts per company. If recruiter searches are thin, use founders, CTOs, VPs/Heads of Engineering, engineering managers, product/AI/data/security leads, or other technical staff who are visibly hiring or leading teams.
- expand: when descriptions are complete and bolstering is no longer yielding easy net-new contacts, add 3-8 new ${sector.label} companies. Prioritize smaller Miami / South Florida companies and startups in this sector, then San Jose / Silicon Valley startups. Reserve IDs with node job/scripts/allocate-company-ids.js before adding.

Expansion focus:
- Prefer Miami, Fort Lauderdale, Boca Raton, West Palm Beach, Coral Gables, Doral, Wynwood, Brickell, and nearby South Florida startup/industrial hubs.
- For construction, industrial, logistics, energy, proptech, hardware, defense, healthcare, fintech, AI, cloud, and cybersecurity sectors, look for small local operators with real software, data, engineering, operations, product, or technical hiring needs.
- Avoid duplicating companies already present in any sector file or canonical JSON. Search exact names and LinkedIn company URLs before adding.

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
    current: stats,
    fingerprint: getFileFingerprint(sector),
    lastError: "",
    lastWarning: "",
  };
  console.log(`  launched ${sector.key.padEnd(10)} pid ${child.pid} | phase:${stats.phase} unpop:${stats.unpopulated} desc:${stats.missingDescriptions} under10:${stats.belowContactTarget}`);
  return true;
}

function countAlive(state, sectors) {
  return sectors.filter((sector) => isAlive(state.sectors[sector.key]?.pid)).length;
}

function workPriority(stats) {
  if (stats.unpopulated > 0) return 0;
  if (stats.missingDescriptions > 0) return 1;
  if (stats.belowContactTarget > 0) return 2;
  return 3;
}

function workNeed(stats) {
  if (stats.unpopulated > 0) return stats.unpopulated;
  if (stats.missingDescriptions > 0) return stats.missingDescriptions;
  if (stats.belowContactTarget > 0) return stats.belowContactTarget;
  return stats.total;
}

function priorityLabel(stats) {
  if (stats.unpopulated > 0) return "empty";
  if (stats.missingDescriptions > 0) return "desc";
  if (stats.belowContactTarget > 0) return "under10";
  return "expand";
}

function launchCandidates(sectors, state) {
  return sectors
    .map((sector, order) => {
      const info = state.sectors[sector.key] || {};
      if (info.pid && isAlive(info.pid)) return null;
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

function launchToConcurrency(sectors, state, concurrency) {
  let alive = countAlive(state, sectors);
  let launched = 0;
  for (const candidate of launchCandidates(sectors, state)) {
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

  const progressed = statsChanged(info.current, afterStats) || fingerprintChanged(info.fingerprint, afterFingerprint);
  info.pid = null;
  info.lastExitAt = now;
  info.lastStats = afterStats || info.lastStats;
  info.lastCompletedAt = completed ? now : info.lastCompletedAt;

  if (progressed) {
    info.lastProgressAt = now;
    info.noProgressCount = 0;
    info.lastWarning = "";
  } else {
    info.noProgressCount = (info.noProgressCount || 0) + 1;
    info.lastWarning = `No file/stat progress detected for batch ${info.batchNumber || "?"}`;
  }

  if (issue && !completed) {
    info.lastError = issue;
  } else if (progressed) {
    info.lastError = "";
  }

  return { progressed, issue: info.lastError || info.lastWarning || "", completed };
}

function refreshExitedWorkers(sectors, state, { log = false } = {}) {
  let changed = false;
  let mergeNeeded = false;

  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    if (!info?.pid || isAlive(info.pid)) continue;
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

function cmdInit() {
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

  console.log(`=== Starting Codex sector swarm (${sectors.length} sectors, concurrency ${concurrency}) ===`);
  console.log("Default behavior is one worker per selected sector.\n");

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
  let total = 0;
  let unpop = 0;
  let missing = 0;
  let below10 = 0;
  let recruiters = 0;

  for (const sector of sectors) {
    const stats = getStats(sector);
    const info = state.sectors[sector.key] || {};
    const alive = isAlive(info.pid);
    total += stats.total;
    unpop += stats.unpopulated;
    missing += stats.missingDescriptions;
    below10 += stats.belowContactTarget;
    recruiters += stats.totalRecruiters;
    const pct = stats.total ? ((stats.populated / stats.total) * 100).toFixed(1) : "0.0";
    const logIssue = !alive ? summarizeLogIssue(info.logFile ? path.join(ROOT, info.logFile) : "") : "";
    let lastIssue = info.lastError || info.lastWarning || logIssue;
    if (String(lastIssue || "").trim().startsWith("{") && !logIssue) {
      lastIssue = info.lastWarning || "";
    }
    const issueText = lastIssue ? ` issue:${truncate(lastIssue, 80)}` : "";
    console.log(
      `${sector.key.padEnd(10)} ${String(stats.populated).padStart(4)}/${String(stats.total).padEnd(4)} (${pct.padStart(5)}%) phase:${stats.phase.padEnd(8)} ` +
      `unpop:${String(stats.unpopulated).padStart(4)} desc:${String(stats.missingDescriptions).padStart(4)} ` +
      `under10:${String(stats.belowContactTarget).padStart(4)} recs:${String(stats.totalRecruiters).padStart(5)} ` +
      `alive:${alive ? "yes" : "no "} batch:${String(info.batchNumber || 0).padStart(3)} next:${priorityLabel(stats).padEnd(7)}${issueText}`
    );
  }

  console.log(`\nTotals: ${total} companies | ${unpop} empty recruiter arrays | ${missing} missing descriptions | ${below10} below 10 contacts | ${recruiters} recruiters`);

  const next = launchCandidates(sectors, state).slice(0, sectors.length).map(({ sector, stats }) => (
    `${sector.key}:${priorityLabel(stats)}(${workNeed(stats)})`
  ));
  if (next.length) console.log(`Next launch order: ${next.join(", ")}`);
}

function cmdStatus(args) {
  const manifest = loadManifest();
  const sectors = selectedSectors(manifest, args);
  const state = loadState();
  const refreshed = refreshExitedWorkers(sectors, state);
  if (refreshed.changed) saveState(state);
  printStatus(sectors, state);
}

function cmdStop(args) {
  const manifest = loadManifest();
  const sectors = selectedSectors(manifest, args);
  const state = loadState();
  const waitMs = getWaitMs(args);
  const mergeAfterStop = !args.includes("--no-merge");

  console.log("=== Stopping Codex sector workers ===\n");
  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    if (!info?.pid) continue;
    if (!isAlive(info.pid)) {
      info.pid = null;
      console.log(`  ${sector.key}: not running`);
      continue;
    }
    try {
      process.kill(info.pid, "SIGTERM");
      console.log(`  ${sector.key}: sent SIGTERM to pid ${info.pid}`);
    } catch {
      console.log(`  ${sector.key}: already stopped`);
      info.pid = null;
    }
  }

  const started = Date.now();
  while (Date.now() - started < waitMs) {
    const stillAlive = sectors.filter((sector) => isAlive(state.sectors[sector.key]?.pid));
    if (stillAlive.length === 0) break;
    sleep(500);
  }

  let aliveAfterStop = 0;
  for (const sector of sectors) {
    const info = state.sectors[sector.key];
    if (!info?.pid) continue;
    if (isAlive(info.pid)) {
      aliveAfterStop++;
      info.lastWarning = `Stop requested, but pid ${info.pid} was still alive after ${waitMs}ms`;
      continue;
    }
    recordExitedSector(sector, state);
  }

  saveState(state);

  if (mergeAfterStop && aliveAfterStop === 0) {
    console.log("\nMerging sector files into canonical/UI JSON...");
    runMerge();
  } else if (mergeAfterStop) {
    console.log(`\nSkipped merge because ${aliveAfterStop} worker(s) are still alive.`);
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

    const launched = launchToConcurrency(sectors, state, concurrency);
    if (launched) changed = true;

    const totals = sectors.reduce((acc, sector) => {
      const stats = getStats(sector);
      acc.unpop += stats.unpopulated;
      acc.missing += stats.missingDescriptions;
      acc.under10 += stats.belowContactTarget;
      acc.expand += stats.phase === "expand" ? 1 : 0;
      return acc;
    }, { unpop: 0, missing: 0, under10: 0, expand: 0 });

    process.stdout.write(
      `\r[${new Date().toISOString().slice(11, 19)}] alive:${countAlive(state, sectors)} expand:${totals.expand}/${sectors.length} unpop:${totals.unpop} desc:${totals.missing} under10:${totals.under10}   `
    );

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
  stop [sectors...]            Stop workers, then merge sector files by default
  merge                        Merge sector files into canonical/UI JSON

Options:
  --concurrency N              Max simultaneous Codex workers (default: one per selected sector)
  --wait-ms N                  Stop wait before merge (default: 15000)
  --no-merge                   Stop workers without the default merge

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
