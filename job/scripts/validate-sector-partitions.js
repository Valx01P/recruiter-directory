#!/usr/bin/env node
/**
 * Validate sector partition health without modifying data.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const MANIFEST_FILE = path.join(ROOT, "job/sectors/manifest.json");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function main() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    fail("Missing job/sectors/manifest.json");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const seenIds = new Map();
  const seenNames = new Map();
  let total = 0;
  let populated = 0;
  let missingDescriptions = 0;
  let underTen = 0;
  let recruiters = 0;

  for (const sector of manifest.sectors || []) {
    const file = path.join(ROOT, sector.file);
    if (!fs.existsSync(file)) {
      fail(`Missing sector file ${sector.file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const companies = data.companies || [];
    total += companies.length;

    for (const company of companies) {
      if (company.sector !== sector.key) {
        fail(`${company.id} ${company.name} has sector=${company.sector}, expected ${sector.key}`);
      }
      if (seenIds.has(company.id)) {
        fail(`Duplicate company id ${company.id} in ${sector.file} and ${seenIds.get(company.id)}`);
      }
      seenIds.set(company.id, sector.file);

      const nameKey = String(company.name || "").trim().toLowerCase();
      if (nameKey) {
        if (seenNames.has(nameKey)) {
          fail(`Duplicate company name "${company.name}" in ${sector.file} and ${seenNames.get(nameKey)}`);
        }
        seenNames.set(nameKey, sector.file);
      }

      const recCount = (company.recruiters || []).length;
      if (recCount > 0) populated++;
      if (recCount < 10) underTen++;
      if (!String(company.description || "").trim()) missingDescriptions++;
      recruiters += recCount;
    }
  }

  console.log("=== Sector Partition Validation ===");
  console.log(`Sectors: ${manifest.sectors.length}`);
  console.log(`Companies: ${total}`);
  console.log(`Unique IDs: ${seenIds.size}`);
  console.log(`Populated: ${populated}`);
  console.log(`Missing descriptions: ${missingDescriptions}`);
  console.log(`Companies below 10 contacts: ${underTen}`);
  console.log(`Recruiters / contacts: ${recruiters}`);

  if (manifest.total_companies !== total) {
    fail(`Manifest total_companies=${manifest.total_companies}, actual=${total}`);
  }
  if (seenIds.size !== total) {
    fail(`Unique ID count ${seenIds.size} does not match company count ${total}`);
  }

  if (!process.exitCode) console.log("OK");
}

main();
