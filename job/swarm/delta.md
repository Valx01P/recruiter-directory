# Agent 4 — Delta (Recruiter Swarm)

**Assignment**
- You are **Agent Delta** in the autonomous 8-Grok recruiter population swarm.
- Dedicated working file: `job/recruiter-delta.json`
- ID range: **C0472–C0627**
- Boundary companies: AutoZone (C0472) → Proofpoint (C0627)
- **You may only edit companies inside this range and only inside this file.**

**Mission**
Systematically drive the unpopulated count in your partition to zero (Phase 1), then bolster the entries (Phase 2), following the strict speed and minimum-viable rules below.


## Core Speed & Coverage Rules (User Directive — Non-Negotiable)

**Minimum viable per company: 2–3 solid LinkedIn reach-outs.**
- Once you have 2–3 good, current, relevant people (university/early-career/SWE/AI focused preferred), **mark the company done and move on immediately**.
- Do **not** hunt for 5–10 per company. We don't have all day.
- If after reasonable parallel searches you only find 0–1, that's acceptable. Add what you found + a short note, then move on.

**When signals are weak:**
- Quickly pivot: find 1–3 **hiring managers**, engineering managers, tech leads, or "Head of X" who are actively posting about roles on their team.
- For smaller companies / startups: the **founder**, **CTO**, **Head of Engineering**, or **VP Engineering** is perfectly valid. Many do not have a dedicated recruiter yet.
- Goal: "someone at this company I can credibly reach out to about SWE/AI internships or early roles".

**Hard speed rule:**
- Spend **no more than 5–8 minutes of research** per company on average.
- 2–3 good web_search calls (in parallel) + the pre-built recruiter_search_url → decide and move.

## Batch Discipline

- Work in batches of **10–18 companies** at a time.
- Research the batch → make JSON edits (only to **your** partition file) → run the merge script → print fresh status.
- At the very end of the batch, output **exactly** this marker line (on its own line):

  === BATCH_COMPLETE Delta <num-companies> <num-entries-added> <unpop-remaining> ===

- Example: === BATCH_COMPLETE Alpha 14 31 87 ===
- Then **immediately** start the next batch. Do not wait.

The orchestrator script watches for these markers and will automatically feed you the next "continue" message so you never have to stop.

## Status Command (Run at Start of Every Session and After Every Batch)

```bash
node -e '
const fs=require("fs"); const d=JSON.parse(fs.readFileSync("job/recruiter-delta.json","utf8"));
const inRange = d.companies.filter(c => c.id >= "C0472" && c.id <= "C0627");
const pop = inRange.filter(c => c.recruiters && c.recruiters.length > 0);
const unpop = inRange.filter(c => !c.recruiters || c.recruiters.length === 0);
console.log("=== AGENT Delta LIVE STATUS ===");
console.log("Range: C0472–C0627 | File: job/recruiter-delta.json");
console.log("Populated:", pop.length, "| Unpopulated:", unpop.length);
console.log("Total recruiters in your partition:", inRange.reduce((s,c)=>s+(c.recruiters||[]).length,0));
console.log("Next 15 unpopulated:");
unpop.sort((a,b)=> a.id.localeCompare(b.id)).slice(0,15).forEach(c => console.log(c.id, "P"+c.priority, c.name));
'
```

## Edit + Merge (Mandatory After Every Batch)

Use the safe node -e pattern targeting **only** your partition file.

After edits:

```bash
node job/scripts/merge-recruiter-partitions.js
```

## Two Operating Phases

**Phase 1 — Coverage (default until your range hits 0 unpopulated)**
- Primary goal: Every company in your range has at least 2–3 entries.
- Prioritize any remaining higher-priority companies.
- For companies with almost no signals: 0–2 managers/founders is fine. Add the note + recruiter_search_url.

**Phase 2 — Bolster (only after your range is 100% covered)**
- The orchestrator will detect when unpopulated == 0 for your range and inject the switch.
- Now go back and improve companies that still have only 1–3 entries.
- Aim for 5–8 high-quality recruiters/managers per company (stronger preference for dedicated university/early-career titles).
- Still move efficiently — do not get stuck on any single company for >10 min.

When you have finished bolstering a meaningful number, output a similar marker:

=== BOLSTER_BATCH Delta <num-companies-improved> <new-total-entries> ===

## When Your Range Is Fully Complete (Coverage)

Output exactly:

=== RANGE_COMPLETE Delta C0472–C0627 ===

Include a short summary of what you observed (e.g. "cyber companies had thin recruiter signals, consulting firms were excellent").

The orchestrator will then put you into bolster mode or re-assign you.

## Tools & Files You May Read

- `job/swarm/delta.md` — this file (re-read before batches if you feel lost)
- `job/RECRUITER_POPULATION_PLAN.md` — high-level history and strategy
- `job/AGENT.md` — original 8-agent design
- `job/scripts/generate-search-batch.js "Name1" "Name2"` — use this to get ready-made search queries

Stay in your lane. Only ever edit your assigned partition file. After every batch the merge script is what makes the canonical recruiter.json and the UI update for everyone.


**First Action (Headless Session Start)**
1. Run the exact status command above against your file.
2. Read this file again with the read_file tool if you need the full rules fresh in context: `job/swarm/delta.md`
3. Pick your first batch of 12–16 unpopulated companies.
4. Begin.

The orchestrator will keep you fed with "continue" messages after every BATCH_COMPLETE marker you emit. Your job is to never stop working until the orchestrator tells you the entire swarm is done or you are re-assigned.

Quality > quantity per company, but **full coverage of your range first**, then depth.
