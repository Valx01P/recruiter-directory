# GROK.md — 4-Agent Parallel Population Instructions

**Mission**: Accelerate filling `job/recruiter.json` (1,251 companies) by splitting the ID space across 4 parallel Grok agents. Each agent owns a contiguous ID range and focuses on populating high-quality university / early-career / SWE & AI intern recruiters for companies in that range.

**Single source of truth**: `job/recruiter.json` (companies[].recruiters[] arrays + meta.last_updated).  
**Companion UI**: `recruiter-directory/` (always sync after edits).  
**Supporting docs**: `job/RECRUITER_POPULATION_PLAN.md` (strategy + logs), `job/RECRUITER_WORKFLOW.md` (schema + manual harvest details).

**Current snapshot (2026-06-02)**: 78 companies populated with 218 total recruiters. P1 (39) complete. P2 partially started. Scattered P3 work from prior bottom-up efforts.

---

## Partition Assignments (Your ID Range)

You will be assigned **one** of the following four partitions. The launcher will tell you "You are Agent Beta" (or similar). Work **only** inside your range unless explicitly told to help another.

| Agent   | ID Range      | Companies | Boundary Companies                  | Notes / Prior Work                  |
|---------|---------------|-----------|-------------------------------------|-------------------------------------|
| **Alpha** | C0001–C0313 | 313      | NVIDIA (C0001) → DRW (C0313)       | Contains all 39 P1 + many early P2. ~56 already populated. Highest density of existing work. |
| **Beta**  | C0314–C0626 | 313      | IMC Trading (C0314) → BeyondTrust (C0626) | Clean slate (0 populated at split time). |
| **Gamma** | C0627–C0939 | 313      | Proofpoint (C0627) → Scopely (C0939) | 7 scattered P3 entries from prior work. |
| **Delta** | C0940–C1251 | 312      | Jam City (C0940) → Insight Global (C1251) | Contains the high-ID tail (some bottom-up P3 work ~C1223+). ~15 populated. |

**Important**:
- Always run a status check at the start of every session to see exact current unpopulated count in *your* range (data may have advanced from other agents or prior sessions).
- Prefer unpopulated companies. For already-populated ones in your range, only touch if you have fresh high-signal additions or corrections (e.g. recruiter left the company).
- ID comparison works with simple string `>=` / `<=` because all IDs are `C` + 4 zero-padded digits (C0001–C1251 lexical order == numeric order).

---

## Quick Status & Planning Commands (Run These First)

```bash
# 1. Your range status (replace START/END with your bounds, e.g. "C0314" "C0626")
node -e '
const fs=require("fs"); const d=JSON.parse(fs.readFileSync("job/recruiter.json","utf8"));
const [start,end]=["C0314","C0626"];
const inRange = d.companies.filter(c => c.id >= start && c.id <= end);
const pop = inRange.filter(c => c.recruiters && c.recruiters.length > 0);
const unpop = inRange.filter(c => !c.recruiters || c.recruiters.length === 0);
const p2 = unpop.filter(c=>c.priority===2);
const p3 = unpop.filter(c=>c.priority===3);
console.log(`Range ${start}-${end}: ${inRange.length} total`);
console.log(`Populated: ${pop.length} | Unpopulated: ${unpop.length} (P2: ${p2.length}, P3: ${p3.length})`);
console.log("Total recruiters in range:", inRange.reduce((s,c)=>s+(c.recruiters||[]).length,0));
console.log("\nNext 15 unpopulated (sorted by priority then id):");
unpop.sort((a,b)=> (a.priority-b.priority) || a.id.localeCompare(b.id))
  .slice(0,15).forEach(c => console.log(c.id, "P"+c.priority, c.name));
'

# 2. Generate ready-to-run search queries for a batch of companies (use names from the list above)
node job/scripts/generate-search-batch.js "Company One" "Company Two" "Company Three"
```

Copy the output queries and run 4–8 of them in parallel via the `web_search` tool.

---

## Core Search Strategy (Use Every Session)

Run these **in parallel** via `web_search` (and `x_keyword_search` / `x_semantic_search` where useful):

1. `"<Company Name>" ("university recruiter" OR "campus recruiter" OR "early career recruiter" OR "talent acquisition" OR "university relations") (intern OR "new grad" OR "early career" OR SWE OR "software engineering") LinkedIn -inurl:jobs`

2. `"<Company Name>" "Recruiter at <Company>" OR "University Recruiter at <Company>" site:linkedin.com/in`

3. `"<Company Name>" (recruiter OR "talent partner") (internship OR "campus recruiting" OR "university hiring") 2025 OR 2026`

High-signal additions:
- Company careers page + "university recruiting team" or "meet the campus team"
- Recent posts on X from the recruiter mentioning interns/hiring at that company

After results:
- Extract LinkedIn profile URLs (`/in/slug-12345/` — clean to canonical).
- Prioritize titles with: University, Campus, Early Career, Emerging Talent, Intern, New Grad, University Relations, Early Talent.
- Verify (as much as public data allows) they appear current.
- Strong preference for US-based / US-hiring focus.
- Target counts per company (realistic):
  - Strong P2/P3 with visible programs: 2–5 recruiters
  - Weaker signals: 1 or 0 (perfectly acceptable — add the `recruiter_search_url` note instead)
- Never add obvious non-current, non-US, or pure agency profiles unless the company has almost no internal team.

**Pro move**: After web results, run targeted X searches for recent activity.

See `job/RECRUITER_POPULATION_PLAN.md` "Core Search Strategy" and `job/RECRUITER_WORKFLOW.md` for deeper LinkedIn UI harvesting tips (the `recruiter_search_url` field in each company is gold — open it in a browser and filter).

---

## Quality Rules (Strict — Do Not Violate)

- Only current employees (recent posts, "X years at Company", active profiles).
- Prefer dedicated university/early-career titles over generic "Technical Recruiter" or "Talent Acquisition Partner".
- US focus (or clearly hires US interns/new grads).
- Skip 3rd-party agencies unless they are the documented primary channel for that company's campus recruiting.
- If a profile 404s later, note it or remove.
- Quality > quantity. One excellent university recruiter > 5 low-signal entries.

---

## Editing the JSON (Safe Pattern)

Use `run_terminal_command` with a node one-liner. **Never** hand-edit the giant file in an editor unless you are extremely careful.

Example — add 2 recruiters to a company:

```bash
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync("job/recruiter.json", "utf8"));
const company = d.companies.find(c => c.id === "C0XXX");
if (!company) { console.error("NOT FOUND"); process.exit(1); }
if (!company.recruiters) company.recruiters = [];

company.recruiters.push(
  {
    "name": "Alex Rivera",
    "title": "University Recruiter, Software Engineering",
    "linkedin_url": "https://www.linkedin.com/in/alex-rivera-12345/",
    "email": "",
    "location": "Austin, TX",
    "focus_area": "University Recruiting / SWE Intern / New Grad",
    "connected": false,
    "messaged": false,
    "responded": false,
    "date_contacted": "",
    "notes": "Posted about 2026 internships on LinkedIn 2025-10-01. Strong campus presence."
  },
  {
    "name": "Jordan Lee",
    "title": "Early Career Talent Partner",
    "linkedin_url": "https://www.linkedin.com/in/jordanlee/",
    "email": "",
    "location": "Remote / Bay Area",
    "focus_area": "Early Career & Intern Programs",
    "connected": false,
    "messaged": false,
    "responded": false,
    "date_contacted": "",
    "notes": ""
  }
);

d.meta.last_updated = "2026-06-03";
fs.writeFileSync("job/recruiter.json", JSON.stringify(d, null, 2));
console.log("Added 2 recruiters to", company.id, company.name, "— new total for company:", company.recruiters.length);
'
```

**After any meaningful batch of edits (or end of focused session)**:

```bash
# Sync to UI (do this from repo root)
cp job/recruiter.json recruiter-directory/data/recruiter.json
cp job/recruiter.json recruiter-directory/public/data/recruiter.json

# Quick validation count
node -e '
const d=require("./job/recruiter.json");
const withR = d.companies.filter(c=>c.recruiters&&c.recruiters.length>0);
console.log("Populated now:", withR.length);
console.log("Total recruiters:", d.companies.reduce((s,c)=>s+(c.recruiters||[]).length,0));
console.log("Your range contribution (example):");
'
```

---

## Session Workflow (Recommended per Agent Session)

1. **Start**: Run the status command for your exact range. Note how many unpopulated P2 vs P3 remain.
2. **Pick batch**: 5–10 companies from your unpopulated list (cluster by sector if possible for search efficiency, or just sequential). Prioritize any remaining P2 in your range.
3. **Research**: Fire 8–12 parallel `web_search` calls using the generated queries + the company's built-in `recruiter_search_url`.
4. **Harvest**: Review results, open promising profiles with `open_page` if needed, extract clean data.
5. **Edit**: Use the node one-liner pattern above (one atomic write per batch or per company).
6. **Log**: 
   - Append a short entry to the "Current Session Log" section in `job/RECRUITER_POPULATION_PLAN.md` (e.g. `**2026-06-03 — Agent Beta Session 3**: C0314–C0325 (12 companies) +47 recruiters`).
   - Update your mental "next starting point" for the range.
7. **Sync** the two `cp` commands above.
8. **Optional**: `cd recruiter-directory && npm run build` if you want to test the UI locally.
9. **End of session**: Update `meta.last_updated` (already done in the edit step) and report summary (companies touched + recruiters added + any hard cases with weak signals).

**Never**:
- Work outside your assigned ID range.
- Duplicate work already present (unless clearly stale/outdated).
- Rush low-quality entries.
- Add recruiters who have zero connection to US early-career/intern hiring.

---

## Coordination Between Agents

- The four ranges are non-overlapping. No ID collisions possible.
- Work can proceed completely independently.
- If you finish your range early (or hit a wall of low-signal companies), announce it and offer to help another agent with their unpopulated tail.
- Major conflicts or strategy changes → update this file + the PLAN.md and ping the owner.
- Git hygiene: commit frequently with clear messages like `chore(recruiters): Agent Gamma +18 recruiters (C0700–C0720)`.

---

## Success Targets (Overall, Not Per Agent)

- Every company with a real structured internship program gets at least 1–2 solid recruiter entries.
- P2 companies average 2–4+.
- High-value P3 (large consultancies, banks, healthcare tech, big retail, etc.) get 1–3 when signals exist.
- Overall goal: 800–1200+ total recruiters across the directory.

---

## Tooling Notes Specific to This Environment

- Primary research: `web_search`, `open_page`, `open_page_with_find`, `x_keyword_search`, `x_semantic_search`.
- JSON inspection/edits: `run_terminal_command` with node -e one-liners (fast and auditable).
- File reads for context: `read_file` on the md docs or specific company entries (use `grep` for quick scans across the JSON if needed).
- For very large result sets from tools, they may be truncated — use targeted follow-ups.
- The `generate-search-batch.js` script is your friend for scaling queries.

---

## When Your Range Is Complete (or Mostly Complete)

1. Run a final full status for your range (all remaining unpopulated should be defensible "weak signal / no public university recruiter profiles found" cases).
2. Add a summary paragraph to `RECRUITER_POPULATION_PLAN.md` Phase 2/3 section.
3. Update this GROK.md with your completion date + total added by you.
4. Offer capacity to the other agents or the long-tail verification pass.

---

**Owner**: Pablo Valdes  
**Last updated**: 2026-06-02 (initial 4-way split)  
**Next step for launcher**: Assign each of 4 Grok sessions one partition + paste the relevant section + current status command output. Let them run in parallel.

Let's finish this directory. Quality first, speed second — but with 4 agents we can have both.
