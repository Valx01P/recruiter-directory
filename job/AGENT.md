# AGENT.md — 8-Agent Parallel Recruiter Population Instructions

**Mission**: Accelerate filling the recruiter directory (1,251 companies) by splitting the ID space across 8 parallel research agents. Each agent owns a contiguous ID range and a dedicated working file, focusing on populating high-quality university / early-career / SWE & AI intern recruiters for companies in that range.

This process is designed for **any capable research agent or AI assistant** (not tied to any specific model or company).

**Working files (independent, non-conflicting)**: 
- `job/recruiter-alpha.json` (Agent 1 — Alpha)
- `job/recruiter-beta.json` (Agent 2 — Beta)
- `job/recruiter-gamma.json` (Agent 3 — Gamma)
- `job/recruiter-delta.json` (Agent 4 — Delta)
- `job/recruiter-epsilon.json` (Agent 5 — Epsilon)
- `job/recruiter-zeta.json` (Agent 6 — Zeta)
- `job/recruiter-eta.json` (Agent 7 — Eta)
- `job/recruiter-theta.json` (Agent 8 — Theta)

**Single source of truth (merged view)**: `job/recruiter.json` (rebuilt from the 8 partitions via the merge script).  
**Companion UI**: `recruiter-directory/` (run the merge script after edits to sync).  
**Supporting docs**: `job/RECRUITER_POPULATION_PLAN.md` (strategy + logs), `job/RECRUITER_WORKFLOW.md` (schema + manual harvest details).

**Current snapshot (2026-06-05)**: 647 companies populated with 1,258 total recruiters across all partitions. 8-way split active. Agents work exclusively in their partition file.

---

## Partition Assignments (Your ID Range + Dedicated File)

You will be assigned **one** of the following eight partitions. The launcher will tell you "You are Agent Zeta" (or similar) and give you your exact working file. Work **only** inside your partition file and ID range unless explicitly told to help another.

| Agent     | Working File                   | ID Range      | Companies | Boundary Companies                          | Current Populated      |
|-----------|--------------------------------|---------------|-----------|---------------------------------------------|------------------------|
| **Alpha**   | `job/recruiter-alpha.json`    | C0001–C0157 | 157      | NVIDIA (C0001) → Kaseya (C0157)            | 130 pop / 299 recs    |
| **Beta**    | `job/recruiter-beta.json`     | C0158–C0314 | 157      | UKG (C0158) → IMC Trading (C0314)          | 38 pop / 53 recs      |
| **Gamma**   | `job/recruiter-gamma.json`    | C0315–C0471 | 157      | Optiver (C0315) → Tractor Supply (C0471)   | 157 pop / 257 recs    |
| **Delta**   | `job/recruiter-delta.json`    | C0472–C0627 | 156      | AutoZone (C0472) → Proofpoint (C0627)      | 36 pop / 72 recs      |
| **Epsilon** | `job/recruiter-epsilon.json`  | C0628–C0783 | 156      | Mimecast (C0628) → Prefect (C0783)         | 52 pop / 84 recs      |
| **Zeta**    | `job/recruiter-zeta.json`     | C0784–C0939 | 156      | Dagster Labs (C0784) → Scopely (C0939)     | 123 pop / 256 recs    |
| **Eta**     | `job/recruiter-eta.json`      | C0940–C1095 | 156      | Jam City (C0940) → Better.com (C1095)      | 96 pop / 185 recs     |
| **Theta**   | `job/recruiter-theta.json`    | C1096–C1251 | 156      | Blend (C1096) → Insight Global (C1251)     | 15 pop / 52 recs      |

**Important**:
- Always run a status check at the start of every session using **your partition file** to see exact current unpopulated count (other agents never touch your file).
- Prefer unpopulated companies in your file. For already-populated ones, only touch if you have fresh high-signal additions or corrections (e.g. recruiter left the company).
- ID comparison works with simple string `>=` / `<=` (C0001–C1251 lexical order == numeric order).
- Your partition file is the only thing you edit directly. After any batch, run the merge script (see below) to update the canonical + UI.

---

## Mandatory Batch Size Rule

**You must work in batches of at least 10 companies at a time** (and all their recruiters).

- Do **not** ask for permission after every 3–5 companies.
- Do **not** stop after a small batch and wait for "keep going".
- Pick 10–15 companies per batch (you can do more if momentum is good).
- Complete the full batch (research + edits + log + merge) before reporting back.
- This keeps progress moving quickly with minimal coordination overhead.

Only report when a batch of ≥10 is fully complete (or if you hit a hard blocker that needs human input).

---

## Quick Status & Planning Commands (Run These First — Use YOUR Partition File)

```bash
# 1. Your range status (replace FILENAME with your partition file, and START/END with your bounds)
# Example for Agent Eta:
node -e '
const fs=require("fs"); const d=JSON.parse(fs.readFileSync("job/recruiter-eta.json","utf8"));
const [start,end]=["C0940","C1095"];
const inRange = d.companies.filter(c => c.id >= start && c.id <= end);
const pop = inRange.filter(c => c.recruiters && c.recruiters.length > 0);
const unpop = inRange.filter(c => !c.recruiters || c.recruiters.length === 0);
const p2 = unpop.filter(c=>c.priority===2);
const p3 = unpop.filter(c=>c.priority===3);
console.log(`Range ${start}-${end} in YOUR partition file: ${inRange.length} total`);
console.log(`Populated: ${pop.length} | Unpopulated: ${unpop.length} (P2: ${p2.length}, P3: ${p3.length})`);
console.log("Total recruiters in your partition:", inRange.reduce((s,c)=>s+(c.recruiters||[]).length,0));
console.log("\nNext 15 unpopulated (sorted by priority then id):");
unpop.sort((a,b)=> (a.priority-b.priority) || a.id.localeCompare(b.id))
  .slice(0,15).forEach(c => console.log(c.id, "P"+c.priority, c.name));
'

# 2. Generate ready-to-run search queries for a batch of companies (use names from the list above)
node job/scripts/generate-search-batch.js "Company One" "Company Two" "Company Three"
```

Copy the output queries and run 6–12 of them in parallel via the `web_search` tool.

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
  - Strong companies with visible programs: 2–5 recruiters
  - Weaker signals: 1 or 0 (perfectly acceptable — add the `recruiter_search_url` note instead)
- Never add obvious non-current, non-US, or pure agency profiles unless the company has almost no internal team.

**Pro move**: After web results, run targeted X searches for recent activity.

See `job/RECRUITER_WORKFLOW.md` for deeper LinkedIn UI harvesting tips (the `recruiter_search_url` field in each company is gold).

---

## Quality Rules (Strict — Do Not Violate)

- Only current employees (recent posts, "X years at Company", active profiles).
- Prefer dedicated university/early-career titles over generic "Technical Recruiter" or "Talent Acquisition Partner".
- US focus (or clearly hires US interns/new grads).
- Skip 3rd-party agencies unless they are the documented primary channel for that company's campus recruiting.
- If a profile 404s later, note it or remove.
- Quality > quantity. One excellent university recruiter > 5 low-signal entries.

---

## Editing the JSON (Safe Pattern — Your Partition File Only)

Use `run_terminal_command` with a node one-liner against **your assigned partition file only**. **Never** hand-edit or touch other agents' files or the canonical `job/recruiter.json` directly.

Example — add recruiters to a company (Agent Zeta example):

```bash
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync("job/recruiter-zeta.json", "utf8"));
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
  }
);

d.meta.last_updated = "2026-06-05";
fs.writeFileSync("job/recruiter-zeta.json", JSON.stringify(d, null, 2));
console.log("Added recruiter to", company.id, company.name, "— new total:", company.recruiters.length);
'
```

**After any meaningful batch of edits (≥10 companies)** — run the merge script:

```bash
# From repo root — this is the ONLY sync step you need
node job/scripts/merge-recruiter-partitions.js
```

**Never edit the canonical `job/recruiter.json` by hand** — it will be overwritten on next merge. Your partition file is your source of truth for your range.

---

## Session Workflow (Recommended per Agent Session)

1. **Start**: Run the status command for your exact range using your partition file. Note how many unpopulated P2 vs P3 remain.
2. **Pick batch**: At least 10–15 companies from your unpopulated list (cluster by sector if possible). Prioritize any remaining P2 in your range.
3. **Research**: Fire 8–15 parallel `web_search` calls using the generated queries + the company's built-in `recruiter_search_url`.
4. **Harvest**: Review results, open promising profiles with `open_page` if needed, extract clean data.
5. **Edit**: Use the node one-liner pattern above targeting only your partition file (one atomic write per batch or per company).
6. **Log**: 
   - Append a short entry to the session log in `job/RECRUITER_POPULATION_PLAN.md` (e.g. `**2026-06-05 — Agent Zeta Batch 2**: C0850–C0870 (14 companies) +41 recruiters`).
7. **Merge & Sync**: Run `node job/scripts/merge-recruiter-partitions.js`.
8. **Report**: Summarize the completed batch (≥10 companies) — companies touched, recruiters added, notable observations, and the post-merge range status output.

**Never**:
- Edit or touch any file except your assigned partition file.
- Work outside your assigned ID range.
- Do small batches under 10 companies and wait for "keep going".
- Duplicate work already present (unless clearly stale/outdated).
- Rush low-quality entries.

---

## Coordination Between Agents

- The eight partitions + files are completely non-overlapping. No ID collisions or edit conflicts possible.
- Work is 100% independent — you never touch another agent's file.
- If you finish your range early (or hit a wall of low-signal companies), announce it and offer to help another agent with their unpopulated tail (they will give you their partition file temporarily or you can be reassigned).
- After you run the merge script, the canonical + UI reflect everyone's latest work.
- Git hygiene: commit frequently with clear messages like `chore(recruiters): Agent Eta +27 recruiters (C1000–C1025) via recruiter-eta.json`.

---

## When Your Range Is Complete (or Mostly Complete)

1. Run a final full status for your range using your partition file.
2. Add a summary paragraph to `RECRUITER_POPULATION_PLAN.md` (under the current 8-agent section).
3. Run the merge script one last time.
4. Update this AGENT.md with your completion date + total added by you in your partition.
5. Offer capacity to the other agents or the long-tail verification pass across remaining partitions.

---

**Owner**: Pablo Valdes  
**Last updated**: 2026-06-05 (8-agent split + dedicated partition files, generic for any research agent)  
**Next step for launcher**: Assign each of 8 agents one partition + its working file (e.g. "You are Agent Eta — edit only job/recruiter-eta.json, range C0940–C1095. Minimum 10 companies per batch.") + paste the relevant launch prompt section + current status command output for that file. Let them run in parallel with minimal check-ins.

Let's finish this directory. Quality first, speed second — with 8 agents + independent files + large batches we move fast with almost zero coordination.