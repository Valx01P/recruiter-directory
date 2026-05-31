#!/usr/bin/env node
/**
 * Merge the 8 agent partition files (Alpha–Theta) into the canonical job/recruiter.json
 * and sync the recruiter-directory UI copies.
 *
 * Usage:
 *   node job/scripts/merge-recruiter-partitions.js
 *
 * Run this after any agent finishes a batch of edits to their partition file.
 * It combines all companies (sorted by id), updates meta, and syncs UI.
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

const PART_FILES = [
  "recruiter-alpha.json",
  "recruiter-beta.json",
  "recruiter-gamma.json",
  "recruiter-delta.json",
  "recruiter-epsilon.json",
  "recruiter-zeta.json",
  "recruiter-eta.json",
  "recruiter-theta.json"
];

// Canonical schemas. The UI (recruiter-directory/app/page.tsx) reads exactly
// these fields, so the merge normalizes every record to them: stray keys an
// agent leaked (e.g. a per-company `meta`) are dropped, and missing recruiter
// tracking fields are backfilled with defaults. Keeps the bundled JSON uniform.
const COMPANY_FIELDS = [
  "id", "name", "category", "hq_location", "priority", "size_estimate",
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
    out[f] = c[f];
  }
  out.recruiters = (c.recruiters || []).map(normalizeRecruiter);
  for (const k of Object.keys(c)) {
    if (!COMPANY_FIELDS.includes(k)) droppedKeys.set(k, (droppedKeys.get(k) || 0) + 1);
  }
  return out;
}

console.log("Merging 8 recruiter partitions (Alpha–Theta) → canonical recruiter.json\n");

let allCompanies = [];
let latestUpdated = "2026-01-01";
let partitionSummaries = [];

PART_FILES.forEach((fname, i) => {
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
  const agentLabel = (data.meta && data.meta.partition && data.meta.partition.agent) || `Part${i+1}`;
  const range = (data.meta && data.meta.partition && data.meta.partition.id_range) || "?";
  partitionSummaries.push(`${agentLabel} (${range}): ${partCos.length} cos, ${pop} pop, ${recs} recs`);
  console.log(`  + ${fname}: ${partCos.length} companies (${pop} populated, ${recs} recruiters)`);
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

console.log(`\nTotal after merge: ${deduped.length} companies, ${totalPop} populated, ${totalRecs} recruiters`);

// Build merged meta (base from first part, override aggregates)
const baseMeta = JSON.parse(fs.readFileSync(path.join(PARTS_DIR, PART_FILES[0]), "utf8")).meta || {};
const mergedMeta = {
  ...baseMeta,
  total_companies: deduped.length,
  last_updated: latestUpdated,
  population_progress: `6-agent parallel split (Alpha–Zeta). ${totalPop} companies populated with ${totalRecs} total recruiters. See job/GROK.md for partitions + working files. Merge run: ${new Date().toISOString().slice(0,10)}`,
  partition: undefined, // remove per-partition marker on the merged canonical
  notes: `Canonical merged file. Source of truth for UI. Agents edit only their job/recruiter-*.json partition files then run this merge script. ${baseMeta.notes || ""}`
};

const merged = {
  meta: mergedMeta,
  companies: deduped
};

fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2));
console.log(`\nWrote merged: ${OUT_FILE}`);

// Sync UI copies
fs.mkdirSync(path.dirname(UI_DATA), { recursive: true });
fs.mkdirSync(path.dirname(UI_PUBLIC), { recursive: true });
fs.copyFileSync(OUT_FILE, UI_DATA);
fs.copyFileSync(OUT_FILE, UI_PUBLIC);
console.log(`Synced UI copies:\n  ${UI_DATA}\n  ${UI_PUBLIC}`);

console.log("\n=== Partition summary ===");
partitionSummaries.forEach(s => console.log("  " + s));

console.log("\nMerge complete. Commit the updated recruiter.json + partition files together.");
