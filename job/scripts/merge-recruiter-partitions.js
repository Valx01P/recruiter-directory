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

function normalizeRecruiter(r) {
  const out = {};
  for (const [k, def] of Object.entries(RECRUITER_DEFAULTS)) {
    out[k] = r[k] !== undefined ? r[k] : def;
  }
  return out;
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
  allCompanies.push(...partCos);

  if (data.meta && data.meta.last_updated && data.meta.last_updated > latestUpdated) {
    latestUpdated = data.meta.last_updated;
  }

  const pop = partCos.filter(c => c.recruiters && c.recruiters.length > 0).length;
  const recs = partCos.reduce((s,c)=>s+(c.recruiters||[]).length,0);
  const missingDescriptions = partCos.filter(c => !String(c.description || "").trim()).length;
  const belowContactTarget = partCos.filter(c => (c.recruiters || []).length < 10).length;
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
  console.log(`  + ${fname}: ${partCos.length} companies (${pop} populated, ${missingDescriptions} missing descriptions, ${recs} recruiters)`);
});

// Sort by id (lexical works because C0001 style)
allCompanies.sort((a,b) => a.id.localeCompare(b.id));

// Dedupe just in case (should not happen)
const seen = new Set();
const deduped = [];
allCompanies.forEach(c => {
  if (seen.has(c.id)) {
    console.warn(`  WARNING: duplicate id ${c.id} found during merge — keeping first`);
    return;
  }
  seen.add(c.id);
  deduped.push(normalizeCompany(c));
});

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
