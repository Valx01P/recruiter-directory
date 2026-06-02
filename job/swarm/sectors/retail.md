# Codex Sector Worker — Retail / Consumer

**Assignment**
- Sector key: `retail`
- Working file: `job/sectors/recruiter-retail.json`
- Companies owned by this sector: 168
- You may edit **only** `job/sectors/recruiter-retail.json`.
- Do not edit `job/recruiter.json`, UI copies, other sector files, or shared docs.
- Do not run the merge script. The orchestrator runs merges centrally after each batch to avoid write races.

**Mission**
Populate this sector with useful outreach data without repeating completed work:
1. Add or improve `company.description` for every company you touch, including companies that already have recruiters.
2. Repair existing `recruiters[]` entries that are missing profile-level LinkedIn URLs before adding new contacts.
3. Add company-level opportunity research for internship/search usefulness.
4. Populate empty `recruiters[]` arrays where credible public LinkedIn/web evidence exists.
5. Keep existing recruiter entries. If an entry appears stale, wrong, duplicated, or questionable, preserve it and add a concise review note instead of removing it.
6. After coverage, cleanup, and enrichment are complete, deepen companies to their contact target: 5 for smaller Miami / South Florida startup teams, 10 for medium/larger companies elsewhere.
7. If a sector is fully covered and bolstering is no longer yielding easy net-new contacts, add more companies in this sector, prioritizing smaller Miami / South Florida companies and startups.

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
- Never exceed the contact target: 5 contacts is enough for smaller Miami / South Florida startup teams; 10 contacts remains the cap for medium/larger companies elsewhere.
- Do not add a recruiter/contact unless `name`, `title` or a clear role, and `linkedin_url` are all complete and publicly verified.
- A LinkedIn company URL, LinkedIn search URL, homepage, directory snippet, SignalHire-style stub, or notes-only reference is not enough for a saved person.
- If you find a new useful person but cannot verify their LinkedIn profile URL, keep that new person out of `recruiters[]`. Add a concise search note to an existing complete contact or company notes instead.
- Use only public professional information. Do not scrape aggressively.

## Opportunity Research Standard

Every company touched should be improved for internship and job-search usefulness:
- Add `company_url` when a real homepage is public.
- Add `careers_url` when a careers/jobs/students page is public.
- Use `early_career_programs` for named programs such as NVIDIA Ignite, Microsoft Explore, university recruiting, apprenticeships, fellowships, internships, co-ops, new-grad programs, or rotational programs.
- Use `application_timeline` for public timing such as "Summer 2026 internships seen opening in Aug-Oct 2025" or "No public student-specific dates found in June 2026; monitor careers page."
- Use `visa_sponsorship` for public evidence only: "sponsors/does not sponsor/varies by role/unknown". Do not infer sponsorship from company size.
- Use `recent_internship_signal` for evidence that interns/new grads were recently hired, roles were posted, or employees mention internships.
- Use `opportunity_notes` for a concise summary of outreach value: Miami/South Florida proximity, startup size, technical hiring fit, student program fit, and best next search/action.
- Set `has_intern_program` true only when a public internship, co-op, university, new-grad, apprenticeship, fellowship, or student program is verified.

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
- Check `job/swarm/codex-sector-stop.json` before starting each new company search and again before writing JSON. If it exists and either has `"all": true` or includes `retail` in `"sectors"`, finish only the company/contact record already in progress, validate JSON, run the final status command, print the marker, and exit.
- Keep candidates outside the JSON until they are complete. Never save a partial person while looking for their LinkedIn URL.
- Batch size: 8-14 companies.
- Phase 1 Coverage: finish missing `description` fields first, then fill any empty `recruiters[]` arrays.
- Phase 2 Link Cleanup: before adding new people or companies, repair existing contacts whose `linkedin_url` is blank or not a person profile URL. Search for the person's current public LinkedIn profile and fill it when verified. If no credible profile URL can be verified, keep the existing contact, add a concise verification-pending note, and move on. Do not delete existing contacts or shrink `recruiters[]` during cleanup; questionable pruning belongs in a separate human-reviewed pass.
- Phase 3 Opportunity Enrichment: add missing company-level opportunity research fields. Include named university/intern/new-grad programs, application timing, visa sponsorship evidence, recent intern-hiring signals, homepage, careers page, and concise opportunity notes.
- Phase 4 Bolster: once every existing company has a description, no broken contact URLs, and opportunity research, improve companies below their contact target. Add recruiters first, then technical hiring managers, founders, CTOs, VPs/Heads of Engineering, engineering managers, product/AI/data/security leads, or team leads who are visibly hiring or leading technical teams.
- Bolster timebox: do not stall on a small company. If 2-3 focused searches do not find credible net-new contacts with verified LinkedIn profile URLs, add no partial contacts, note the search path in an existing complete contact or company notes, and move on.
- Phase 5 Expansion: if descriptions, link cleanup, opportunity enrichment, and bolster work are no longer producing easy improvements, add 3-8 new companies in this sector per batch. Prioritize smaller Miami / South Florida companies and small businesses with technical hiring signals, then medium-sized companies elsewhere in the United States. Add descriptions, opportunity research, and at least 1-3 complete contacts for new companies where possible.
- Expansion geography: Miami, Fort Lauderdale, Boca Raton, West Palm Beach, Coral Gables, Doral, Wynwood, Brickell, and nearby South Florida startup/industrial hubs first; then San Jose, Santa Clara, Sunnyvale, Mountain View, Palo Alto, and nearby Silicon Valley startup hubs.
- Expansion sector fit: for construction, industrial, logistics, energy, proptech, hardware, defense, healthcare, fintech, AI, cloud, and cybersecurity sectors, prefer smaller local operators with real software, data, engineering, operations, product, or technical hiring needs.
- Expansion contact target: for smaller Miami / South Florida startup entries, 5 good contacts is enough. For medium-sized companies elsewhere in the United States, keep the 10-contact maximum target.
- Spend roughly 5-8 minutes per company on average.
- Use web search in parallel where possible:
  - `"<Company>" ("university recruiter" OR "campus recruiter" OR "early career recruiter" OR "talent acquisition") (intern OR "new grad" OR SWE OR software) LinkedIn -inurl:jobs`
  - `"<Company>" "Recruiter at <Company>" OR "University Recruiter at <Company>" site:linkedin.com/in`
  - `"<Company>" (recruiter OR "talent partner" OR "hiring") (internship OR "campus recruiting" OR "university hiring") 2025 OR 2026`
  - `"<Company>" (internship OR intern OR "new grad" OR university OR student) careers applications 2026`
  - `"<Company>" ("visa sponsorship" OR "work authorization" OR "sponsor") careers`
  - `site:linkedin.com/in "<Company>" (intern OR "software engineer intern" OR "new grad")`

## Required Start Status Command

```bash
node -e '
const fs=require("fs"); const d=JSON.parse(fs.readFileSync("job/sectors/recruiter-retail.json","utf8"));
const companies=d.companies||[];
const isSoFla=c=>/miami|fort lauderdale|boca raton|west palm beach|coral gables|doral|wynwood|brickell|aventura|hollywood|pompano|delray|south florida/i.test(String(c.hq_location||""));
const target=c=>isSoFla(c)?5:10;
const profileUrl=r=>/(^|\.)linkedin\.com\/(in|pub)\//i.test(String((r&&r.linkedin_url)||""));
const needsLinkCleanup=c=>(c.recruiters||[]).filter(r=>String(r.name||"").trim()&&!profileUrl(r)).length;
const hasOpportunity=c=>[
  c.company_url,
  c.careers_url,
  c.early_career_programs,
  c.application_timeline,
  c.visa_sponsorship,
  c.recent_internship_signal,
  c.opportunity_notes
].some(v=>String(v||"").trim())||Boolean(c.has_intern_program);
const unpop=companies.filter(c=>!(c.recruiters||[]).length);
const missing=companies.filter(c=>!String(c.description||"").trim());
const linkCleanup=companies.filter(c=>needsLinkCleanup(c)>0);
const enrich=companies.filter(c=>!hasOpportunity(c));
const underTarget=companies.filter(c=>(c.recruiters||[]).length<target(c));
const linkCount=linkCleanup.reduce((s,c)=>s+needsLinkCleanup(c),0);
const phase=(unpop.length||missing.length) ? "coverage" : (linkCount ? "cleanup" : (enrich.length ? "enrich" : (underTarget.length ? "bolster" : "expand")));
console.log("=== SECTOR retail STATUS ===");
console.log("File: job/sectors/recruiter-retail.json");
console.log("Phase:", phase, "| Companies:", companies.length, "| Unpopulated:", unpop.length, "| Missing descriptions:", missing.length, "| Contacts needing profile URLs:", linkCount, "| Missing opportunity research:", enrich.length, "| Below contact target:", underTarget.length);
console.log("Recruiters:", companies.reduce((s,c)=>s+(c.recruiters||[]).length,0));
console.log("Next work:");
const seen=new Set();
const queue=[...unpop, ...missing, ...linkCleanup, ...enrich, ...underTarget].filter(c=>{ if(seen.has(c.id)) return false; seen.add(c.id); return true; });
queue
  .sort((a,b)=>(a.priority-b.priority)||a.id.localeCompare(b.id))
  .slice(0,14)
  .forEach(c=>console.log(c.id, "P"+c.priority, c.name, "| recs="+((c.recruiters||[]).length)+"/"+target(c), "| desc="+(String(c.description||"").trim() ? "yes" : "no"), "| badLinks="+needsLinkCleanup(c), "| opp="+(hasOpportunity(c) ? "yes" : "no")));
'
```

## Edit Pattern

Use a small Node script or safe JSON-aware edit against `job/sectors/recruiter-retail.json` only. Preserve JSON formatting with two-space indentation.

Before adding a recruiter/contact:
- Check the existing `recruiters[]` array and do not duplicate a person or LinkedIn URL.
- Keep current useful entries; append only net-new contacts.
- Confirm `linkedin_url` is a person/profile URL before writing the contact. If a link is missing or only points to a company/search page, do not add that person.

When cleaning existing contacts:
- Do not reduce recruiter/contact count just because a profile URL is missing.
- Fill `linkedin_url` when verified.
- If no profile URL is found, preserve the contact and append a short note such as `LinkedIn profile URL not verified in June 2026 cleanup pass`.
- Do not remove contacts in cleanup, including suspected duplicates, note-only rows, blank-name rows, or contacts that may belong elsewhere. Preserve them and add a concise review note; questionable pruning belongs in a separate human-reviewed pass.

Before adding a new company:
- Search all sector files and canonical JSON by exact company name, normalized company name, and LinkedIn company URL so you do not duplicate existing work.
- If the company already exists in another sector, do not add a second copy unless it is a genuinely distinct subsidiary, product group, or acquired entity with separate hiring. Pick a different new company instead.
- Reserve IDs with `node job/scripts/allocate-company-ids.js <count>`.
- Fill opportunity fields for new companies during the same pass. If no public program/date/sponsorship data is found, write that as a concise "not found in public search" note instead of leaving the research ambiguous.
- Use this company shape:

```json
{
  "id": "C1252",
  "name": "Company Name",
  "category": "Retail / Consumer",
  "sector": "retail",
  "description": "One concise sentence describing the company.",
  "hq_location": "Miami, FL",
  "priority": 3,
  "size_estimate": "",
  "company_url": "",
  "early_career_programs": "",
  "application_timeline": "",
  "visa_sponsorship": "",
  "recent_internship_signal": "",
  "opportunity_notes": "",
  "has_intern_program": false,
  "linkedin_company_url": "",
  "linkedin_url_verified": false,
  "recruiter_search_url": "https://www.linkedin.com/search/results/people/?keywords=Company%20Name%20recruiter",
  "careers_url": "",
  "recruiters": []
}
```

After the batch, run the status command again and print this exact marker on its own line:

`=== SECTOR_BATCH_COMPLETE retail <companies-touched> <entries-added> <remaining-unpopulated> <remaining-missing-descriptions> ===`
