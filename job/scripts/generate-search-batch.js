#!/usr/bin/env node

/**
 * Helper script for continuous recruiter population.
 * Usage:
 *   node job/scripts/generate-search-batch.js "Cloudflare" "Figma" "Ramp" "Kaseya"
 *
 * It will output ready-to-run web_search queries you (or the AI) can execute in parallel.
 */

const companies = process.argv.slice(2);

if (companies.length === 0) {
  console.log(`
Usage: node job/scripts/generate-search-batch.js "Company One" "Company Two" ...

This generates high-signal web_search queries for university/early-career recruiters.
Copy the queries and run them via the available web_search tool.
`);
  process.exit(1);
}

console.log(`\n=== Generated Search Queries for ${companies.length} companies ===\n`);

companies.forEach((company, i) => {
  const encoded = encodeURIComponent(company);
  console.log(`// ${i + 1}. ${company}`);
  console.log(`web_search query: ${company} "university recruiter" OR "campus recruiter" OR "early career recruiter" OR "university relations" OR "emerging talent" (intern OR "new grad" OR SWE) LinkedIn -inurl:jobs`);
  console.log(`Alternative: "${company}" "Recruiter at ${company}" OR "University Recruiter at ${company}" site:linkedin.com/in`);
  console.log('');
});

console.log(`\nTotal queries generated: ${companies.length * 2}`);
console.log('Tip: Run 4-6 companies worth of searches in parallel per session for best results.\n');
