#!/usr/bin/env node
/**
 * Build independent sector-owned recruiter partitions from the canonical file.
 *
 * Usage:
 *   node job/scripts/build-sector-partitions.js
 *   node job/scripts/build-sector-partitions.js --input job/recruiter.json
 *
 * Run this only when sector agents are stopped. It rewrites job/sectors/*.json
 * from the canonical dataset so each company has exactly one writable owner.
 */

const fs = require("fs");
const path = require("path");
const { ALL_SECTORS, primarySectorForCompany } = require("./sector-taxonomy");

const ROOT = path.resolve(__dirname, "../..");
const JOB_DIR = path.join(ROOT, "job");
const OUT_DIR = path.join(JOB_DIR, "sectors");
const DEFAULT_INPUT = path.join(JOB_DIR, "recruiter.json");

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function recruiterCount(companies) {
  return companies.reduce((sum, company) => sum + (company.recruiters || []).length, 0);
}

function companyHasDescription(company) {
  return typeof company.description === "string" && company.description.trim().length > 0;
}

function isSouthFloridaCompany(company) {
  return /miami|fort lauderdale|boca raton|west palm beach|coral gables|doral|wynwood|brickell|aventura|hollywood|pompano|delray|south florida/i.test(
    String(company.hq_location || "")
  );
}

function contactTargetForCompany(company) {
  return isSouthFloridaCompany(company) ? 5 : 10;
}

function normalizeCompany(company, sectorKey) {
  return {
    id: company.id,
    name: company.name,
    category: company.category,
    sector: sectorKey,
    description: typeof company.description === "string" ? company.description : "",
    hq_location: company.hq_location,
    priority: company.priority,
    size_estimate: company.size_estimate,
    company_url: company.company_url,
    early_career_programs: company.early_career_programs,
    application_timeline: company.application_timeline,
    visa_sponsorship: company.visa_sponsorship,
    recent_internship_signal: company.recent_internship_signal,
    opportunity_notes: company.opportunity_notes,
    has_intern_program: company.has_intern_program,
    linkedin_company_url: company.linkedin_company_url,
    linkedin_url_verified: company.linkedin_url_verified,
    recruiter_search_url: company.recruiter_search_url,
    careers_url: company.careers_url,
    recruiters: company.recruiters || [],
  };
}

function main() {
  const inputPath = path.resolve(ROOT, getArg("--input", DEFAULT_INPUT));
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing input file: ${inputPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const buckets = new Map(ALL_SECTORS.map((sector) => [sector.key, []]));

  for (const original of data.companies || []) {
    const sector = primarySectorForCompany(original);
    buckets.get(sector.key).push(normalizeCompany(original, sector.key));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sectors = [];
  for (const sector of ALL_SECTORS) {
    const companies = (buckets.get(sector.key) || []).sort((a, b) => a.id.localeCompare(b.id));
    if (companies.length === 0) continue;

    const file = `recruiter-${sector.key}.json`;
    const outPath = path.join(OUT_DIR, file);
    const populated = companies.filter((company) => (company.recruiters || []).length > 0).length;
    const missingDescription = companies.filter((company) => !companyHasDescription(company)).length;
    const belowContactTarget = companies.filter((company) => (company.recruiters || []).length < contactTargetForCompany(company)).length;
    const totalRecruiters = recruiterCount(companies);

    const partition = {
      meta: {
        ...(data.meta || {}),
        total_companies: companies.length,
        partition_type: "sector",
        sector: {
          key: sector.key,
          label: sector.label,
        },
        source_file: path.relative(ROOT, inputPath),
        last_partition_build: new Date().toISOString(),
        notes: `Sector working file for ${sector.label}. Codex agents edit only this file; the orchestrator merges sector files back into canonical recruiter.json.`,
      },
      companies,
    };

    fs.writeFileSync(outPath, JSON.stringify(partition, null, 2) + "\n");

    sectors.push({
      key: sector.key,
      label: sector.label,
      file: `job/sectors/${file}`,
      count: companies.length,
      populated,
      missing_description: missingDescription,
      below_contact_target: belowContactTarget,
      total_recruiters: totalRecruiters,
      company_ids: companies.map((company) => company.id),
    });
  }

  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    source_file: path.relative(ROOT, inputPath),
    total_companies: sectors.reduce((sum, sector) => sum + sector.count, 0),
    sectors,
  };

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`Built ${sectors.length} sector partitions in ${path.relative(ROOT, OUT_DIR)}`);
  for (const sector of sectors) {
    console.log(
      `${sector.key.padEnd(10)} ${String(sector.count).padStart(4)} companies | ` +
      `${String(sector.populated).padStart(4)} populated | ` +
      `${String(sector.missing_description).padStart(4)} missing descriptions | ` +
      `${String(sector.total_recruiters).padStart(5)} recruiters`
    );
  }
}

main();
