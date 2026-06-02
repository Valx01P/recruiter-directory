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

function normalizeCompanyName(s) {
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

function isSouthFloridaCompany(company) {
  return /miami|fort lauderdale|boca raton|west palm beach|coral gables|doral|wynwood|brickell|aventura|hollywood|pompano|delray|south florida/i.test(
    String(company.hq_location || "")
  );
}

function contactTargetForCompany(company) {
  return isSouthFloridaCompany(company) ? 5 : 10;
}

function hasLinkedInProfileUrl(url) {
  return /(^|\.)linkedin\.com\/(in|pub)\//i.test(String(url || ""));
}

function recruiterNeedsLinkCleanup(recruiter) {
  return String(recruiter.name || "").trim() && !hasLinkedInProfileUrl(recruiter.linkedin_url);
}

function recruiterKey(recruiter) {
  const name = normalizeCompanyName(recruiter.name);
  if (name) return `name:${name}`;
  const url = normalizeUrl(recruiter.linkedin_url);
  if (url) return `url:${url}`;
  const title = normalizeCompanyName(recruiter.title);
  return title ? `title:${title}|location:${normalizeCompanyName(recruiter.location)}` : "";
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

function main() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    fail("Missing job/sectors/manifest.json");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const seenIds = new Map();
  const seenNames = new Map();
  const duplicateNames = [];
  let total = 0;
  let populated = 0;
  let missingDescriptions = 0;
  let underTen = 0;
  let recruiters = 0;
  let recruiterLinkCleanup = 0;
  let duplicateRecruiterRows = 0;
  const duplicateRecruiterExamples = [];
  let missingOpportunityResearch = 0;

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

      const nameKey = normalizeCompanyName(company.name);
      if (nameKey) {
        if (seenNames.has(nameKey)) {
          duplicateNames.push(`Duplicate company name "${company.name}" in ${sector.file} and ${seenNames.get(nameKey)}`);
        } else {
          seenNames.set(nameKey, sector.file);
        }
      }

      const recCount = (company.recruiters || []).length;
      if (recCount > 0) populated++;
      if (recCount < contactTargetForCompany(company)) underTen++;
      if (!String(company.description || "").trim()) missingDescriptions++;
      recruiters += recCount;
      recruiterLinkCleanup += (company.recruiters || []).filter(recruiterNeedsLinkCleanup).length;
      const seenRecruiters = new Map();
      for (const recruiter of company.recruiters || []) {
        const key = recruiterKey(recruiter);
        if (!key) continue;
        if (seenRecruiters.has(key)) {
          duplicateRecruiterRows++;
          if (duplicateRecruiterExamples.length < 20) {
            duplicateRecruiterExamples.push(`${company.id} ${company.name}: duplicate recruiter "${recruiter.name || recruiter.linkedin_url || recruiter.title}" in ${sector.file}`);
          }
        } else {
          seenRecruiters.set(key, true);
        }
      }
      if (!hasOpportunityResearch(company)) missingOpportunityResearch++;
    }
  }

  console.log("=== Sector Partition Validation ===");
  console.log(`Sectors: ${manifest.sectors.length}`);
  console.log(`Companies: ${total}`);
  console.log(`Unique IDs: ${seenIds.size}`);
  console.log(`Populated: ${populated}`);
  console.log(`Missing descriptions: ${missingDescriptions}`);
  console.log(`Companies below contact target: ${underTen}`);
  console.log(`Recruiters / contacts: ${recruiters}`);
  console.log(`Contacts needing profile URL cleanup: ${recruiterLinkCleanup}`);
  console.log(`Duplicate recruiter rows: ${duplicateRecruiterRows}`);
  console.log(`Companies missing opportunity research: ${missingOpportunityResearch}`);

  if (manifest.total_companies !== total) {
    fail(`Manifest total_companies=${manifest.total_companies}, actual=${total}`);
  }
  if (seenIds.size !== total) {
    fail(`Unique ID count ${seenIds.size} does not match company count ${total}`);
  }

  if (duplicateNames.length) {
    console.warn(`WARN: ${duplicateNames.length} duplicate company name(s) found across or within sector files; merge will collapse them by normalized name.`);
    duplicateNames.slice(0, 20).forEach(message => console.warn(`  ${message}`));
    if (duplicateNames.length > 20) console.warn(`  ... ${duplicateNames.length - 20} more`);
  }

  if (duplicateRecruiterRows) {
    duplicateRecruiterExamples.forEach(message => fail(message));
    if (duplicateRecruiterRows > duplicateRecruiterExamples.length) {
      fail(`${duplicateRecruiterRows - duplicateRecruiterExamples.length} additional duplicate recruiter row(s) found`);
    }
  }

  if (!process.exitCode) console.log("OK");
}

main();
