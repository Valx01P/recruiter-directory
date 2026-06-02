#!/usr/bin/env node
/**
 * Restore missing recruiter/contact rows from a source recruiter JSON.
 *
 * Default source is HEAD:job/recruiter.json so a bad cleanup pass can recover
 * useful legacy leads while preserving current company/enrichment fields.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const SECTOR_DIR = path.join(ROOT, "job/sectors");
const DEFAULT_GIT_SOURCE = "HEAD:job/recruiter.json";

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? fallback : process.argv[idx + 1] || fallback;
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

function normalizeUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function hasProfileUrl(url) {
  return /(^|\.)linkedin\.com\/(in|pub)\//i.test(String(url || ""));
}

function recruiterKey(recruiter) {
  const url = normalizeUrl(recruiter.linkedin_url);
  if (url) return `url:${url}`;
  const name = normalizeLookup(recruiter.name);
  if (!name) return "";
  return `name:${name}|title:${normalizeLookup(recruiter.title)}`;
}

function companyKeys(company) {
  return [
    `id:${company.id || ""}`,
    `name:${normalizeLookup(company.name)}`,
  ].filter((key) => !key.endsWith(":"));
}

function loadSource() {
  const sourceFile = getArg("--source");
  if (sourceFile) {
    return JSON.parse(fs.readFileSync(path.resolve(ROOT, sourceFile), "utf8"));
  }
  const gitSource = getArg("--git-source", DEFAULT_GIT_SOURCE);
  const raw = execFileSync("git", ["show", gitSource], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function sourceCompanyMap(source) {
  const map = new Map();
  for (const company of source.companies || []) {
    for (const key of companyKeys(company)) {
      if (!map.has(key)) map.set(key, company);
    }
  }
  return map;
}

function mergeText(a, b) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left) return right;
  if (!right || left.includes(right)) return left;
  return `${left} ${right}`;
}

function restoredRecruiter(raw) {
  const recruiter = { ...raw };
  if (!hasProfileUrl(recruiter.linkedin_url)) {
    recruiter.notes = mergeText(
      recruiter.notes,
      "Restored from pre-cleanup dataset; LinkedIn profile URL still needs verification."
    );
  }
  return recruiter;
}

function restoreFile(file, sourceMap) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let restored = 0;
  let merged = 0;

  for (const company of data.companies || []) {
    const sourceCompany = companyKeys(company).map((key) => sourceMap.get(key)).find(Boolean);
    if (!sourceCompany) continue;

    const recruiters = company.recruiters || [];
    const byKey = new Map();
    recruiters.forEach((recruiter, idx) => {
      const key = recruiterKey(recruiter);
      if (key) byKey.set(key, idx);
    });

    for (const raw of sourceCompany.recruiters || []) {
      if (!String(raw?.name || "").trim()) continue;
      const key = recruiterKey(raw);
      if (!key) continue;
      if (!byKey.has(key)) {
        recruiters.push(restoredRecruiter(raw));
        byKey.set(key, recruiters.length - 1);
        restored++;
        continue;
      }
      const existing = recruiters[byKey.get(key)];
      if (!hasProfileUrl(existing.linkedin_url) && hasProfileUrl(raw.linkedin_url)) {
        existing.linkedin_url = raw.linkedin_url;
        merged++;
      }
      existing.notes = mergeText(existing.notes, raw.notes);
    }
    company.recruiters = recruiters;
  }

  if (restored || merged) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  }
  return { restored, merged };
}

function main() {
  const source = loadSource();
  const sourceMap = sourceCompanyMap(source);
  let totalRestored = 0;
  let totalMerged = 0;

  for (const name of fs.readdirSync(SECTOR_DIR).sort()) {
    if (!/^recruiter-.+\.json$/.test(name)) continue;
    const file = path.join(SECTOR_DIR, name);
    const result = restoreFile(file, sourceMap);
    totalRestored += result.restored;
    totalMerged += result.merged;
    if (result.restored || result.merged) {
      console.log(`${path.relative(ROOT, file)}: restored ${result.restored}, merged URLs ${result.merged}`);
    }
  }

  console.log(`Total restored contacts: ${totalRestored}`);
  console.log(`Total merged profile URLs: ${totalMerged}`);
}

main();
