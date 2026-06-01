# Codex Sector Worker — Cloud / DevTools

**Assignment**
- Sector key: `cloud`
- Working file: `job/sectors/recruiter-cloud.json`
- Companies owned by this sector: 206
- You may edit **only** `job/sectors/recruiter-cloud.json`.
- Do not edit `job/recruiter.json`, UI copies, other sector files, or shared docs.
- Do not run the merge script. The orchestrator runs merges centrally after each batch to avoid write races.

**Mission**
Populate this sector with useful outreach data without repeating completed work:
1. Add or improve `company.description` for every company you touch, including companies that already have recruiters.
2. Populate empty `recruiters[]` arrays where credible public LinkedIn/web evidence exists.
3. Keep existing recruiter entries unless you can clearly tell they are stale or wrong.
4. After coverage is complete, deepen companies to a maximum of 10 contacts each.
5. If a sector is fully covered and bolstering is no longer yielding easy net-new contacts, add more companies in this sector, prioritizing smaller Miami / South Florida companies and startups.

## Company Description Standard

Every touched company should have a concise description:
- 18-35 words, one sentence.
- Say what the company actually does and where it fits in the sector.
- Prefer concrete products, customers, or technical domain over marketing language.
- Mention SWE/AI relevance only when it is natural.
- Do not invent facts. If public data is thin, use a conservative description based on the company category and careers/company page.

Example:
`"NVIDIA designs GPUs, AI accelerators, networking hardware, and software platforms used across data centers, gaming, autonomous systems, and applied machine learning."`

## Recruiter Standard

Minimum viable per company:
- Strong signals: add 2-3 current, relevant recruiters or talent partners, then move on.
- Weak signals: 1 recruiter is acceptable; for startups or thin teams, use a founder, CTO, VP Engineering, Head of Engineering, hiring manager, or technical lead.
- Prefer university, campus, emerging talent, early-career, intern, new grad, SWE, AI, ML, or technical recruiting titles.
- In bolster mode, technical members who are publicly hiring for their team are valid, especially for internship, new-grad, SWE, AI, ML, data, infrastructure, or product engineering roles.
- US-based or clearly US-hiring people are preferred.
- Never add more than 10 contacts to a company. If it already has 10 or more, skip it unless correcting stale data.
- Use only public professional information. Do not scrape aggressively.

Recruiter object schema:
```json
{
  "name": "",
  "title": "",
  "linkedin_url": "",
  "email": "",
  "location": "",
  "focus_area": "",
  "connected": false,
  "messaged": false,
  "responded": false,
  "date_contacted": "",
  "notes": ""
}
```

## Batch Rules

- Do exactly one batch per Codex invocation, then exit after printing the marker.
- Batch size: 8-14 companies.
- Phase 1 Coverage: finish missing `description` fields first, then fill any empty `recruiters[]` arrays.
- Phase 2 Bolster: once every existing company has a description and at least one contact, improve companies with fewer than 10 contacts. Add recruiters first, then technical hiring managers, founders, CTOs, VPs/Heads of Engineering, engineering managers, product/AI/data/security leads, or team leads who are visibly hiring or leading technical teams.
- Bolster timebox: do not stall on a small company. If 2-3 focused searches do not find credible net-new contacts, keep any useful technical lead you found, note the search path in the contact notes, and move on.
- Phase 3 Expansion: if descriptions are complete and bolster work is no longer producing easy net-new contacts, add 3-8 new companies in this sector per batch. Prioritize smaller Miami / South Florida companies and startups, then San Jose / Silicon Valley startups. Add descriptions and at least 1-3 contacts for new companies where possible.
- Expansion geography: Miami, Fort Lauderdale, Boca Raton, West Palm Beach, Coral Gables, Doral, Wynwood, Brickell, and nearby South Florida startup/industrial hubs first; then San Jose, Santa Clara, Sunnyvale, Mountain View, Palo Alto, and nearby Silicon Valley startup hubs.
- Expansion sector fit: for construction, industrial, logistics, energy, proptech, hardware, defense, healthcare, fintech, AI, cloud, and cybersecurity sectors, prefer smaller local operators with real software, data, engineering, operations, product, or technical hiring needs.
- Spend roughly 5-8 minutes per company on average.
- Use web search in parallel where possible:
  - `"<Company>" ("university recruiter" OR "campus recruiter" OR "early career recruiter" OR "talent acquisition") (intern OR "new grad" OR SWE OR software) LinkedIn -inurl:jobs`
  - `"<Company>" "Recruiter at <Company>" OR "University Recruiter at <Company>" site:linkedin.com/in`
  - `"<Company>" (recruiter OR "talent partner" OR "hiring") (internship OR "campus recruiting" OR "university hiring") 2025 OR 2026`

## Required Start Status Command

```bash
node -e '
const fs=require("fs"); const d=JSON.parse(fs.readFileSync("job/sectors/recruiter-cloud.json","utf8"));
const companies=d.companies||[];
const unpop=companies.filter(c=>!(c.recruiters||[]).length);
const missing=companies.filter(c=>!String(c.description||"").trim());
const under10=companies.filter(c=>(c.recruiters||[]).length<10);
const phase=(unpop.length||missing.length) ? "coverage" : (under10.length ? "bolster" : "expand");
console.log("=== SECTOR cloud STATUS ===");
console.log("File: job/sectors/recruiter-cloud.json");
console.log("Phase:", phase, "| Companies:", companies.length, "| Unpopulated:", unpop.length, "| Missing descriptions:", missing.length, "| Below 10 contacts:", under10.length);
console.log("Recruiters:", companies.reduce((s,c)=>s+(c.recruiters||[]).length,0));
console.log("Next work:");
[...unpop, ...missing.filter(c=>!unpop.some(u=>u.id===c.id)), ...under10.filter(c=>!unpop.some(u=>u.id===c.id)&&!missing.some(m=>m.id===c.id))]
  .sort((a,b)=>(a.priority-b.priority)||a.id.localeCompare(b.id))
  .slice(0,14)
  .forEach(c=>console.log(c.id, "P"+c.priority, c.name, "| recs="+((c.recruiters||[]).length), "| desc="+(String(c.description||"").trim() ? "yes" : "no")));
'
```

## Edit Pattern

Use a small Node script or safe JSON-aware edit against `job/sectors/recruiter-cloud.json` only. Preserve JSON formatting with two-space indentation.

Before adding a recruiter/contact:
- Check the existing `recruiters[]` array and do not duplicate a person or LinkedIn URL.
- Keep current useful entries; append only net-new contacts.

Before adding a new company:
- Search all sector files and canonical JSON by exact company name, normalized company name, and LinkedIn company URL so you do not duplicate existing work.
- If the company already exists in another sector, do not add a second copy unless it is a genuinely distinct subsidiary, product group, or acquired entity with separate hiring. Pick a different new company instead.
- Reserve IDs with `node job/scripts/allocate-company-ids.js <count>`.
- Use this company shape:

```json
{
  "id": "C1252",
  "name": "Company Name",
  "category": "Cloud / DevTools",
  "sector": "cloud",
  "description": "One concise sentence describing the company.",
  "hq_location": "Miami, FL",
  "priority": 3,
  "size_estimate": "",
  "has_intern_program": false,
  "linkedin_company_url": "",
  "linkedin_url_verified": false,
  "recruiter_search_url": "https://www.linkedin.com/search/results/people/?keywords=Company%20Name%20recruiter",
  "careers_url": "",
  "recruiters": []
}
```

After the batch, run the status command again and print this exact marker on its own line:

`=== SECTOR_BATCH_COMPLETE cloud <companies-touched> <entries-added> <remaining-unpopulated> <remaining-missing-descriptions> ===`
