#!/usr/bin/env node
/**
 * Merge recruiter partition files into the canonical job/recruiter.json
 * and sync the recruiter-directory UI copies.
 *
 * Usage:
 *   node job/scripts/merge-recruiter-partitions.js
 *   node job/scripts/merge-recruiter-partitions.js --source sectors
 *
 * Sector partitions are the only supported source.
 *
 * This script is generic for any research/AI agent assisting with recruiter population.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const PARTS_DIR = path.join(ROOT, "job");
const OUT_FILE = path.join(ROOT, "job/recruiter.json");
const UI_DATA = path.join(ROOT, "recruiter-directory/data/recruiter.json");
const UI_PUBLIC = path.join(ROOT, "recruiter-directory/public/data/recruiter.json");
const SECTOR_MANIFEST = path.join(ROOT, "job/sectors/manifest.json");

// Canonical schemas. The UI (recruiter-directory/app/page.tsx) reads exactly
// these fields, so the merge normalizes every record to them: stray keys an
// agent leaked (e.g. a per-company `meta`) are dropped, and missing recruiter
// tracking fields are backfilled with defaults. Keeps the bundled JSON uniform.
const COMPANY_FIELDS = [
  "id", "name", "category", "sector", "description", "hq_location", "priority", "size_estimate",
  "has_intern_program", "linkedin_company_url", "linkedin_url_verified",
  "recruiter_search_url", "careers_url", "recruiters"
];
const RECRUITER_DEFAULTS = {
  name: "", title: "", linkedin_url: "", email: "", location: "",
  focus_area: "", connected: false, messaged: false, responded: false,
  date_contacted: "", notes: ""
};

const droppedKeys = new Map(); // unexpected key -> count, for a single summary line
const duplicateCompanyMerges = [];

function normalizeRecruiter(r) {
  const out = {};
  for (const [k, def] of Object.entries(RECRUITER_DEFAULTS)) {
    out[k] = r[k] !== undefined ? r[k] : def;
  }
  return out;
}

function normalizeLookup(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|company|co|plc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedCompanyName(company) {
  return normalizeLookup(company.name);
}

function normalizeUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isSouthFloridaCompany(company) {
  return /miami|fort lauderdale|boca raton|west palm beach|coral gables|doral|wynwood|brickell|aventura|hollywood|pompano|delray|south florida/i.test(
    String(company.hq_location || "")
  );
}

function contactTargetForCompany(company) {
  return isSouthFloridaCompany(company) ? 5 : 10;
}

function recruiterKey(recruiter) {
  const url = normalizeUrl(recruiter.linkedin_url);
  if (url) return `url:${url}`;
  const name = normalizeLookup(recruiter.name);
  if (!name) return "";
  return `name:${name}|title:${normalizeLookup(recruiter.title)}`;
}

function mergeRecruiter(existing, incoming) {
  const merged = { ...existing };
  for (const [key, defaultValue] of Object.entries(RECRUITER_DEFAULTS)) {
    if (typeof defaultValue === "boolean") {
      merged[key] = Boolean(existing[key]) || Boolean(incoming[key]);
      continue;
    }
    if (!isPresent(merged[key]) && isPresent(incoming[key])) {
      merged[key] = incoming[key];
    }
  }

  const existingNotes = String(existing.notes || "").trim();
  const incomingNotes = String(incoming.notes || "").trim();
  if (existingNotes && incomingNotes && existingNotes !== incomingNotes && !existingNotes.includes(incomingNotes)) {
    merged.notes = `${existingNotes} ${incomingNotes}`;
  }

  return normalizeRecruiter(merged);
}

function mergeRecruiterLists(a = [], b = []) {
  const out = [];
  const byKey = new Map();

  for (const raw of [...a, ...b]) {
    const recruiter = normalizeRecruiter(raw || {});
    const key = recruiterKey(recruiter);
    if (!key) {
      out.push(recruiter);
      continue;
    }
    if (byKey.has(key)) {
      const idx = byKey.get(key);
      out[idx] = mergeRecruiter(out[idx], recruiter);
    } else {
      byKey.set(key, out.length);
      out.push(recruiter);
    }
  }

  return out;
}

function descriptionScore(description) {
  const text = String(description || "").trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  let score = Math.min(text.length, 260);
  if (words >= 18 && words <= 35) score += 80;
  if (words < 8) score -= 80;
  if (/^(software|technology|company|platform)$/i.test(text)) score -= 100;
  return score;
}

function bestDescription(a, b) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left) return right;
  if (!right) return left;
  return descriptionScore(right) > descriptionScore(left) ? right : left;
}

function mergeCompany(existing, incoming) {
  const merged = { ...existing };

  for (const field of COMPANY_FIELDS) {
    if (field === "recruiters" || field === "description") continue;
    if (field === "priority") {
      const a = Number(merged.priority);
      const b = Number(incoming.priority);
      if (Number.isFinite(a) && Number.isFinite(b)) merged.priority = Math.min(a, b);
      else if (!Number.isFinite(a) && Number.isFinite(b)) merged.priority = incoming.priority;
      continue;
    }
    if (field === "has_intern_program" || field === "linkedin_url_verified") {
      merged[field] = Boolean(merged[field]) || Boolean(incoming[field]);
      continue;
    }
    if (!isPresent(merged[field]) && isPresent(incoming[field])) {
      merged[field] = incoming[field];
    }
  }

  merged.description = bestDescription(merged.description, incoming.description);
  merged.recruiters = mergeRecruiterLists(merged.recruiters, incoming.recruiters);
  return normalizeCompany(merged);
}

function normalizeCompany(c) {
  const out = {};
  for (const f of COMPANY_FIELDS) {
    if (f === "recruiters") continue;
    if (f === "description") out[f] = typeof c[f] === "string" ? c[f] : "";
    else if (f === "sector") out[f] = typeof c[f] === "string" ? c[f] : "";
    else out[f] = c[f];
  }
  out.recruiters = (c.recruiters || []).map(normalizeRecruiter);
  for (const k of Object.keys(c)) {
    if (!COMPANY_FIELDS.includes(k)) droppedKeys.set(k, (droppedKeys.get(k) || 0) + 1);
  }
  return out;
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? "" : (process.argv[idx + 1] || "");
}

function loadPartitionConfig() {
  const source = getArg("--source") || process.env.RECRUITER_PARTITION_SOURCE || "";
  if (source && source !== "sectors") {
    console.error(`ERROR: Unknown --source ${source}. Sector partitions are the only supported source.`);
    process.exit(1);
  }
  if (!fs.existsSync(SECTOR_MANIFEST)) {
    console.error("ERROR: Missing sector manifest. Run:");
    console.error("  node job/scripts/build-sector-partitions.js");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(SECTOR_MANIFEST, "utf8"));
  return {
    mode: "sectors",
    label: "sector recruiter partitions",
    manifest,
    files: manifest.sectors.map((sector) => ({
      fname: sector.file.replace(/^job\//, ""),
      agentLabel: sector.label,
      range: sector.key,
    })),
  };
}

const partitionConfig = loadPartitionConfig();

console.log(`Merging ${partitionConfig.label} → canonical recruiter.json\n`);

let allCompanies = [];
let latestUpdated = "2026-01-01";
let partitionSummaries = [];
let updatedSectorSummaries = [];

partitionConfig.files.forEach(({ fname, agentLabel: fallbackAgentLabel, range: fallbackRange }, i) => {
  const fpath = path.join(PARTS_DIR, fname);
  if (!fs.existsSync(fpath)) {
    console.error(`ERROR: Missing partition file: ${fpath}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
  const partCos = data.companies || [];

  if (data.meta && data.meta.last_updated && data.meta.last_updated > latestUpdated) {
    latestUpdated = data.meta.last_updated;
  }

  const pop = partCos.filter(c => c.recruiters && c.recruiters.length > 0).length;
  const recs = partCos.reduce((s,c)=>s+(c.recruiters||[]).length,0);
  const missingDescriptions = partCos.filter(c => !String(c.description || "").trim()).length;
  const belowContactTarget = partCos.filter(c => (c.recruiters || []).length < contactTargetForCompany(c)).length;
  const agentLabel =
    (data.meta && data.meta.sector && data.meta.sector.label) ||
    (data.meta && data.meta.partition && data.meta.partition.agent) ||
    fallbackAgentLabel ||
    `Part${i+1}`;
  const range =
    (data.meta && data.meta.sector && data.meta.sector.key) ||
    (data.meta && data.meta.partition && data.meta.partition.id_range) ||
    fallbackRange ||
    "?";
  partitionSummaries.push(`${agentLabel} (${range}): ${partCos.length} cos, ${pop} pop, ${recs} recs`);
  if (partitionConfig.mode === "sectors") {
    updatedSectorSummaries.push({
      key: range,
      label: agentLabel,
      file: `job/${fname}`,
      count: partCos.length,
      populated: pop,
      missing_description: missingDescriptions,
      below_contact_target: belowContactTarget,
      total_recruiters: recs,
      company_ids: partCos.map(c => c.id),
    });
  }
  partCos.forEach(company => {
    allCompanies.push({
      company,
      sourceFile: `job/${fname}`,
      sourceSector: range,
    });
  });
  console.log(`  + ${fname}: ${partCos.length} companies (${pop} populated, ${missingDescriptions} missing descriptions, ${recs} recruiters)`);
});

// Sort by id (lexical works because C0001 style)
allCompanies.sort((a,b) => String(a.company.id || "").localeCompare(String(b.company.id || "")));

// Dedupe by stable ID or normalized company name. Expansion workers can
// independently discover the same company in different sectors; canonical JSON
// keeps one company row and merges the recruiter/contact evidence from all copies.
const byId = new Map();
const byName = new Map();
const deduped = [];
allCompanies.forEach(({ company, sourceFile, sourceSector }) => {
  const normalized = normalizeCompany(company);
  const nameKey = normalizedCompanyName(normalized);
  const existingIdx =
    byId.has(normalized.id) ? byId.get(normalized.id) :
    nameKey && byName.has(nameKey) ? byName.get(nameKey) :
    -1;

  if (existingIdx !== -1) {
    const before = deduped[existingIdx];
    deduped[existingIdx] = mergeCompany(before, normalized);
    byId.set(normalized.id, existingIdx);
    if (nameKey) byName.set(nameKey, existingIdx);
    duplicateCompanyMerges.push({
      kept_id: deduped[existingIdx].id,
      merged_id: normalized.id,
      name: deduped[existingIdx].name || normalized.name,
      sector: sourceSector,
      file: sourceFile,
    });
    return;
  }

  const idx = deduped.length;
  deduped.push(normalized);
  byId.set(normalized.id, idx);
  if (nameKey) byName.set(nameKey, idx);
});

if (duplicateCompanyMerges.length) {
  console.log(`  Merged duplicate company discoveries: ${duplicateCompanyMerges.length}`);
  duplicateCompanyMerges.slice(0, 25).forEach((dup) => {
    const idText = dup.kept_id === dup.merged_id ? dup.kept_id : `${dup.kept_id} <= ${dup.merged_id}`;
    console.log(`    - ${idText} ${dup.name} (${dup.sector}, ${dup.file})`);
  });
  if (duplicateCompanyMerges.length > 25) {
    console.log(`    ... ${duplicateCompanyMerges.length - 25} more`);
  }
}

if (droppedKeys.size) {
  const summary = [...droppedKeys.entries()].map(([k, n]) => `${k} (${n})`).join(", ");
  console.log(`  Normalized: dropped non-schema company keys → ${summary}`);
}

const totalPop = deduped.filter(c => c.recruiters && c.recruiters.length > 0).length;
const totalRecs = deduped.reduce((s,c)=>s+(c.recruiters||[]).length,0);
const totalMissingDescriptions = deduped.filter(c => !String(c.description || "").trim()).length;

console.log(`\nTotal after merge: ${deduped.length} companies, ${totalPop} populated, ${totalMissingDescriptions} missing descriptions, ${totalRecs} recruiters`);

// Build merged meta (base from first part, override aggregates)
const baseMeta = JSON.parse(fs.readFileSync(path.join(PARTS_DIR, partitionConfig.files[0].fname), "utf8")).meta || {};
const mergedMeta = {
  ...baseMeta,
  total_companies: deduped.length,
  last_updated: latestUpdated,
  company_field_legend: {
    ...(baseMeta.company_field_legend || {}),
    sector: "Primary sector partition key used by Codex sector workers and UI filtering",
    description: "Concise company description for search, semantic matching, and outreach context",
  },
  population_progress: `Codex sector split. ${totalPop} companies populated with ${totalRecs} total recruiters; ${totalMissingDescriptions} company descriptions missing. Merge run: ${new Date().toISOString().slice(0,10)}`,
  partition: undefined, // remove per-partition marker on the merged canonical
  sector: undefined,
  partition_type: undefined,
  source_file: undefined,
  last_partition_build: undefined,
  notes: `Canonical merged file. Source of truth for UI. Codex sector agents edit only job/sectors/recruiter-*.json; orchestrator runs this merge centrally. ${baseMeta.notes || ""}`
};

const merged = {
  meta: mergedMeta,
  companies: deduped
};

const tmpOut = `${OUT_FILE}.tmp`;
fs.writeFileSync(tmpOut, JSON.stringify(merged, null, 2) + "\n");
fs.renameSync(tmpOut, OUT_FILE);
console.log(`\nWrote merged: ${OUT_FILE}`);

// Sync UI copies
fs.mkdirSync(path.dirname(UI_DATA), { recursive: true });
fs.mkdirSync(path.dirname(UI_PUBLIC), { recursive: true });
fs.copyFileSync(OUT_FILE, UI_DATA);
fs.copyFileSync(OUT_FILE, UI_PUBLIC);
console.log(`Synced UI copies:\n  ${UI_DATA}\n  ${UI_PUBLIC}`);

if (partitionConfig.manifest) {
  const refreshedManifest = {
    ...partitionConfig.manifest,
    generated_at: partitionConfig.manifest.generated_at,
    last_merged_at: new Date().toISOString(),
    total_companies: updatedSectorSummaries.reduce((sum, s) => sum + s.count, 0),
    sectors: updatedSectorSummaries,
  };
  fs.writeFileSync(SECTOR_MANIFEST, JSON.stringify(refreshedManifest, null, 2) + "\n");
  console.log(`Refreshed sector manifest: ${SECTOR_MANIFEST}`);
}

console.log("\n=== Partition summary ===");
partitionSummaries.forEach(s => console.log("  " + s));

console.log("\nMerge complete. Commit the updated recruiter.json + partition files together.");
