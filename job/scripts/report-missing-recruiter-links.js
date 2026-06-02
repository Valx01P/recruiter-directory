#!/usr/bin/env node
/**
 * Report saved recruiter/contact entries that do not have a LinkedIn profile URL.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_SAMPLE_LIMIT = 8;

function relative(file) {
  return path.relative(ROOT, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function defaultFiles() {
  const files = [
    path.join(ROOT, "job/recruiter.json"),
    path.join(ROOT, "recruiter-directory/data/recruiter.json"),
  ];
  const sectorDir = path.join(ROOT, "job/sectors");
  if (fs.existsSync(sectorDir)) {
    for (const name of fs.readdirSync(sectorDir).sort()) {
      if (/^recruiter-.+\.json$/.test(name)) files.push(path.join(sectorDir, name));
    }
  }
  return files.filter((file) => fs.existsSync(file));
}

function parseArgs(argv) {
  const files = [];
  let samples = DEFAULT_SAMPLE_LIMIT;
  let fail = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fail") {
      fail = true;
      continue;
    }
    if (arg === "--samples") {
      samples = Number(argv[++i] || DEFAULT_SAMPLE_LIMIT);
      continue;
    }
    if (arg.startsWith("--samples=")) {
      samples = Number(arg.slice("--samples=".length));
      continue;
    }
    files.push(path.resolve(ROOT, arg));
  }

  return {
    files: files.length ? files : defaultFiles(),
    samples: Number.isFinite(samples) && samples >= 0 ? Math.floor(samples) : DEFAULT_SAMPLE_LIMIT,
    fail,
  };
}

function hasProfileUrl(url) {
  return /(^|\.)linkedin\.com\/(in|pub)\//i.test(String(url || ""));
}

function inspectFile(file, sampleLimit) {
  const data = readJson(file);
  let total = 0;
  let missing = 0;
  let nonProfile = 0;
  const samples = [];

  for (const company of data.companies || []) {
    for (const recruiter of company.recruiters || []) {
      total++;
      const url = String(recruiter.linkedin_url || "").trim();
      const hasName = String(recruiter.name || "").trim();
      if (!url && hasName) {
        missing++;
        if (samples.length < sampleLimit) {
          samples.push(`${company.id || "?"} ${company.name || "(unknown company)"} -> ${recruiter.name} | ${recruiter.title || "(no title)"}`);
        }
      } else if (url && !hasProfileUrl(url)) {
        nonProfile++;
        if (samples.length < sampleLimit) {
          samples.push(`${company.id || "?"} ${company.name || "(unknown company)"} -> ${recruiter.name || "(no name)"} | ${url}`);
        }
      }
    }
  }

  return { file, total, missing, nonProfile, samples };
}

function main() {
  const { files, samples, fail } = parseArgs(process.argv.slice(2));
  let badFiles = 0;

  for (const file of files) {
    const result = inspectFile(file, samples);
    const bad = result.missing + result.nonProfile;
    if (!bad) continue;
    badFiles++;
    console.log(`${relative(result.file)}: ${bad}/${result.total} contacts need profile URLs (${result.missing} missing, ${result.nonProfile} non-profile links)`);
    for (const sample of result.samples) console.log(`  - ${sample}`);
  }

  if (!badFiles) {
    console.log("No saved recruiter/contact entries with missing or non-profile LinkedIn URLs found.");
  }

  if (fail && badFiles) process.exit(1);
}

main();
