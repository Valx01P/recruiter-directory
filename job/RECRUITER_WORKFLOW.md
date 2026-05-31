# Recruiter JSON Population Workflow

## Goal
Populate `job/recruiter.json` `companies[].recruiters[]` arrays with real, verified LinkedIn recruiter profiles for US tech companies (focus on those with internship programs). This powers outreach for SWE/AI internships.

**Current state**: 1251 companies, 39 priority-1, 93 priority-2, rest priority-3. All `recruiters: []` empty as of 2026-05-30.

## Recruiter Object Schema
```json
{
  "name": "Jane Doe",
  "title": "University Recruiter, Software Engineering",
  "linkedin_url": "https://www.linkedin.com/in/janedoe/",
  "email": "jane.doe@company.com (optional, only if public)",
  "location": "Austin, TX (or Remote)",
  "focus_area": "University Recruiting / SWE Intern / New Grad",
  "connected": false,
  "messaged": false,
  "responded": false,
  "date_contacted": "",
  "notes": "Posted about 2026 internships on 2025-10-01. Prefers InMail."
}
```

## Recommended Workflow (Manual + Tool Assisted)

### 1. Preparation (do once)
- Log into LinkedIn in your browser (desktop recommended).
- Have this JSON file open in an editor (VSCode with JSON formatter).
- Know the company's `id` (e.g. C0001 for NVIDIA) and `recruiter_search_url`.

### 2. Primary Harvest Method: LinkedIn People Search (Best Quality)
For a target company:
1. Open the pre-built `recruiter_search_url` from the JSON entry (e.g. `https://www.linkedin.com/search/results/people/?keywords=NVIDIA%20recruiter`).
2. Add filters in LinkedIn UI:
   - **Current company**: the exact company (it will suggest once you type name).
   - **Title**: "Recruiter" OR "Talent Acquisition" OR "University Recruiter" OR "Talent Partner".
   - **Location**: United States (or specific HQ metro).
   - **Keywords**: "intern" OR "university" OR "new grad" OR "campus".
3. Sort by "Recently joined" or "Connections" sometimes surfaces active ones.
4. For each promising profile (look for: "Recruiter at <Company>", recent activity about hiring, 500+ connections, US-based):
   - Open profile in new tab (Cmd/Ctrl+click).
   - Copy: Full name, headline/title, location (city), profile URL (clean it to `/in/slug/`).
   - Optional: About section snippet for notes, recent posts mentioning interns.
   - Paste into JSON as new object in that company's `recruiters` array.
5. Repeat for 5-15 solid profiles per company (diminishing returns after that).

**Pro tip**: After initial search, try variant searches:
- `https://www.linkedin.com/search/results/people/?keywords=NVIDIA%20%22university%20recruiting%22`
- `https://www.linkedin.com/search/results/people/?keywords=NVIDIA%20%22talent%20acquisition%22`

### 3. Secondary Method: Google / Web Search (Good for Surfacing Public Profiles)
Use the `web_search` tool (or manual Google):
- Query: `NVIDIA "recruiter" OR "university recruiter" OR "talent acquisition" site:linkedin.com/in`
- Query: `"works at NVIDIA" recruiter intern`
- Query: `NVIDIA campus recruiting team LinkedIn`

From results, extract profile URLs. Verify they are current by opening (or using open_page tool here).

Also search X/Twitter: `NVIDIA recruiter hiring intern` (use x_keyword_search tool).

### 4. Tertiary: Company Career Pages + Known Sources
- Visit company's careers/internship page (add to `careers_url` when found).
- Look for "Meet the Team" or recruiting blog posts.
- Check Levels.fyi, TeamBlind, Reddit (r/cscareerquestions, r/internships) for recent "who to contact at <company>" threads.
- Follow company university recruiting Twitter/LinkedIn posts.

### 5. Quality Rules (Strict)
- Only add **current** employees (check "X years at Company" or recent posts).
- Prefer **university / early-career / intern focused** titles over general "Technical Recruiter".
- US-based or US-hiring focus (even if remote).
- Skip obvious fake/spam profiles or 3rd-party agencies unless the company uses them exclusively.
- If profile URL 404s later, mark in notes or remove.
- `linkedin_url_verified` on company is already set; for people it's the profile itself.

### 6. Updating the JSON
- Keep arrays sorted? Optional (maybe by last name or title).
- After adding 3+, update top-level `meta.last_updated`.
- Run validation (see below).
- Commit with message like `chore(recruiters): add 7 NVIDIA + 4 Google recruiters (C0001,C0002)`.

### 7. Validation / Helper Scripts (Run Locally)
Create/run these as needed:

```bash
# Count recruiters per company, show top populated
node -e '
const d=require("./job/recruiter.json");
const withR = d.companies.filter(c=>c.recruiters.length>0).sort((a,b)=>b.recruiters.length-a.recruiters.length);
console.log("Populated companies:", withR.length);
withR.slice(0,20).forEach(c => console.log(c.id, c.name, c.recruiters.length));
console.log("Total recruiters:", d.companies.reduce((s,c)=>s+c.recruiters.length,0));
'

# Validate schema (basic)
node scripts/validate-recruiters.js
```

See `job/scripts/` (create if needed) for helpers.

### 8. Outreach Tracking (Future)
Once populated:
- Use `connected`, `messaged`, `responded`, `date_contacted`, `notes`.
- Consider a simple Airtable/Notion sync or a small CRM script later.
- Never spam — personalize with their recent posts.

### 9. Tooling Tips (This Environment)
- Use `web_search` tool with query like: `NVIDIA university recruiter LinkedIn`
- Use `open_page` on specific LinkedIn profile URLs (public info only, may be limited).
- Use `x_keyword_search` or `x_semantic_search` for recent tweets from/by recruiters: `from:someuser NVIDIA intern` or keywords.
- For bulk research sessions: pick 5 priority-1 companies, harvest 5-8 each per session.
- Never automate aggressive scraping — LinkedIn bans accounts.

### Priority Order Recommendation
1. All 39 Priority 1 companies (top targets: NVIDIA, Google, Microsoft, Amazon, Apple, Meta, OpenAI, Anthropic, etc.)
2. Then Priority 2 (strong targets)
3. Only spot-check Priority 3 unless a specific company becomes hot.

### Example First 5 Targets (C0001-C0005)
- NVIDIA (C0001) — Semiconductors/AI, heavy intern hiring
- Google (C0002)
- Microsoft (C0003)
- Amazon (C0004)
- Apple (C0005)

Start here, then move to OpenAI/Anthropic (very high signal).

## Maintenance
- Re-check high-value companies quarterly (recruiters move jobs often).
- When a recruiter responds positively, update flags + notes immediately.
- If company rebrands/acquires (e.g. Twitter->X), update name + URLs + search link.

## The UI Directory
A simple Next.js search UI lives at `recruiter-directory/`. It consumes the JSON and gives you:

- Fast search across everything
- One-click "Find more recruiters" buttons (opens the LinkedIn people search for that company)
- Direct "Message" links + copy buttons for every profile
- CSV export of all your current recruiters
- Filters by priority + "only populated"

After editing `job/recruiter.json`, run:
```bash
cp job/recruiter.json recruiter-directory/data/recruiter.json
cp job/recruiter.json recruiter-directory/public/data/recruiter.json
```
Then `cd recruiter-directory && npm run dev` (or rebuild for deploy).

See `recruiter-directory/README.md` for details.

## Ethics / Notes
- Only public professional info.
- Respect "Do Not Contact" or recruiter preferences.
- This is for personal outreach, not commercial scraping.
- LinkedIn ToS: manual research is generally fine; bulk automation is not.

Last workflow update: 2026-06-05
Owner: Pablo Valdes

**Current operating mode (see job/AGENT.md)**: 8-agent parallel with dedicated partition files (`job/recruiter-alpha.json` through `job/recruiter-theta.json`). After edits to a partition file, run `node job/scripts/merge-recruiter-partitions.js` to update the canonical `job/recruiter.json` + UI copies. All agent work now happens exclusively in the per-agent partition files. Minimum batch size is 10 companies.
```

Now, update the todo and start populating some using tools.