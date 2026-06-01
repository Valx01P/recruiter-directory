# Recruiter Population Plan

Current workflow: Codex sector swarm. The old Grok/alpha-theta ID partitions were removed after their data was merged into canonical sector files.

## Source Of Truth

- Canonical merged data: `job/recruiter.json`
- Writable partitions: `job/sectors/recruiter-*.json`
- Sector manifest: `job/sectors/manifest.json`
- Launch instructions: `job/HUMAN_START.md`
- Worker instructions: `job/swarm/sectors/*.md`

Do not edit old ID-range partitions; they no longer exist. Codex workers edit only their assigned sector file, and the orchestrator centrally merges sector files back to canonical/UI JSON.

## Current Baseline

- Companies: 1,250 unique companies
- Existing contacts preserved: 1,937 recruiter / hiring contacts
- Populated companies: 873
- Empty recruiter arrays: 377
- Missing company descriptions: 1,250
- Company contacts target: up to 10 per company

One duplicate existing company record was removed during cleanup: `WHOOP` / `Whoop` existed twice. The stronger `C0854` hardware/wearables record with real recruiters was kept.

## Phases

### 1. Coverage

For every existing company in a sector:
- Add a concise `description`.
- Fill empty `recruiters[]` with 1-3 credible public contacts where possible.
- Preserve existing recruiter/contact data.

### 2. Bolster

After a sector has no empty recruiter arrays and no missing descriptions:
- Deepen existing companies up to 10 contacts total.
- Prefer recruiters and talent partners first.
- Then add technical hiring managers, founders, CTOs, VPs of Engineering, engineering managers, and team leads who are publicly hiring interns or early-career SWE/AI/ML/data/infrastructure talent.
- Stop at 10 contacts per company.

### 3. Expansion

After existing companies are covered and deepened:
- Add new companies in the same sector.
- Prioritize Miami, Fort Lauderdale, Boca Raton, West Palm Beach, San Jose, Santa Clara, Sunnyvale, Mountain View, Palo Alto, and nearby tech/startup hubs.
- Search all existing sector files before adding a company.
- Reserve IDs with `node job/scripts/allocate-company-ids.js <count>`.
- Add descriptions and 1-3 contacts where possible.

## Commands

```bash
node job/scripts/codex-sector-orchestrator.js status
node job/scripts/codex-sector-orchestrator.js start
node job/scripts/codex-sector-orchestrator.js monitor
node job/scripts/codex-sector-orchestrator.js stop
node job/scripts/validate-sector-partitions.js
```

Default concurrency is 12. The scheduler gives worker slots to never-started and empty recruiter partitions first, then missing descriptions, then companies below 10 contacts, then expansion. `stop` merges sector files back into canonical/UI JSON by default.
