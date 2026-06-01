# Codex Sector Worker — EdTech / HR Tech

**Assignment**
- Sector key: `edhr`
- Working file: `job/sectors/recruiter-edhr.json`
- Companies owned by this sector: 58
- You may edit **only** `job/sectors/recruiter-edhr.json`.
- Do not edit `job/recruiter.json`, UI copies, other sector files, or shared docs.
- Do not run the merge script. The orchestrator runs merges centrally after each batch to avoid write races.

**Mission**
Populate this sector with useful outreach data without repeating completed work:
1. Add or improve `company.description` for every company you touch, including companies that already have recruiters.
2. Populate empty `recruiters[]` arrays where credible public LinkedIn/web evidence exists.
3. Keep existing recruiter entries unless you can clearly tell they are stale or wrong.
4. After coverage is complete, deepen companies to a maximum of 10 contacts each.
5. After existing companies are deepened, add more companies in this sector, prioritizing Miami / South Florida and San Jose / Silicon Valley.

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
- Phase 1 Coverage: prioritize companies with empty `recruiters[]`; then companies missing `description`.
- Phase 2 Bolster: once every existing company has a description and at least one contact, improve companies with fewer than 10 contacts. Add recruiters first, then technical hiring managers / founders / team leads who are visibly hiring interns or early-career technical talent.
- Phase 3 Expansion: once the existing sector list is reasonably deepened, add 3-8 new companies in this sector per batch. Prioritize Miami, Fort Lauderdale, Boca Raton, West Palm Beach, San Jose, Santa Clara, Sunnyvale, Mountain View, Palo Alto, and nearby startup/tech hubs. Add descriptions and at least 1-3 contacts for new companies where possible.
- Spend roughly 5-8 minutes per company on average.
- Use web search in parallel where possible:
  - `"<Company>" ("university recruiter" OR "campus recruiter" OR "early career recruiter" OR "talent acquisition") (intern OR "new grad" OR SWE OR software) LinkedIn -inurl:jobs`
  - `"<Company>" "Recruiter at <Company>" OR "University Recruiter at <Company>" site:linkedin.com/in`
  - `"<Company>" (recruiter OR "talent partner" OR "hiring") (internship OR "campus recruiting" OR "university hiring") 2025 OR 2026`

## Required Start Status Command

```bash
node -e '
const fs=require("fs"); const d=JSON.parse(fs.readFileSync("job/sectors/recruiter-edhr.json","utf8"));
const companies=d.companies||[];
const unpop=companies.filter(c=>!(c.recruiters||[]).length);
const missing=companies.filter(c=>!String(c.description||"").trim());
const under10=companies.filter(c=>(c.recruiters||[]).length<10);
const phase=(unpop.length||missing.length) ? "coverage" : (under10.length ? "bolster" : "expand");
console.log("=== SECTOR edhr STATUS ===");
console.log("File: job/sectors/recruiter-edhr.json");
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

Use a small Node script or safe JSON-aware edit against `job/sectors/recruiter-edhr.json` only. Preserve JSON formatting with two-space indentation.

Before adding a recruiter/contact:
- Check the existing `recruiters[]` array and do not duplicate a person or LinkedIn URL.
- Keep current useful entries; append only net-new contacts.

Before adding a new company:
- Search all sector files and canonical JSON by exact company name so you do not duplicate existing work.
- Reserve IDs with `node job/scripts/allocate-company-ids.js <count>`.
- Use this company shape:

```json
{
  "id": "C1252",
  "name": "Company Name",
  "category": "EdTech / HR Tech",
  "sector": "edhr",
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

`=== SECTOR_BATCH_COMPLETE edhr <companies-touched> <entries-added> <remaining-unpopulated> <remaining-missing-descriptions> ===`
