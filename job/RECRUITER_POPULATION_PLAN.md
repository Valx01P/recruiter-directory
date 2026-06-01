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
- Company contacts target: 5 for smaller Miami / South Florida startup teams, up to 10 for medium/larger companies elsewhere

One duplicate existing company record was removed during cleanup: `WHOOP` / `Whoop` existed twice. The stronger `C0854` hardware/wearables record with real recruiters was kept.

## Phases

### 1. Coverage

For every existing company in a sector:
- Add a concise `description`.
- Fill empty `recruiters[]` with 1-3 credible public contacts where possible.
- Preserve existing recruiter/contact data.

### 2. Bolster

After a sector has no empty recruiter arrays and no missing descriptions:
- Deepen existing companies up to their contact target: 5 for smaller Miami / South Florida startup teams, 10 for medium/larger companies elsewhere.
- Prefer recruiters and talent partners first.
- Then add technical hiring managers, founders, CTOs, VPs of Engineering, engineering managers, and team leads who are publicly hiring interns or early-career SWE/AI/ML/data/infrastructure talent.
- Stop at the company target.

### 3. Expansion

After existing companies are covered and deepened:
- Add new companies in the same sector.
- Prioritize Miami, Fort Lauderdale, Boca Raton, West Palm Beach, Coral Gables, Doral, Wynwood, Brickell, and nearby South Florida startup/industrial hubs.
- After South Florida, add medium-sized companies around the United States that fit the sector.
- Search all existing sector files before adding a company.
- Reserve IDs with `node job/scripts/allocate-company-ids.js <count>`.
- Add descriptions and 1-3 contacts initially, then bolster South Florida startups to 5 good contacts and medium-sized companies to 10 max.

## Commands

```bash
node job/scripts/codex-sector-orchestrator.js status
node job/scripts/codex-sector-orchestrator.js start
node job/scripts/codex-sector-orchestrator.js monitor
node job/scripts/codex-sector-orchestrator.js stop
node job/scripts/validate-sector-partitions.js
```

Default concurrency is one worker per selected sector, so running `start` with no sector arguments works all sectors at the same time. `stop` merges sector files back into canonical/UI JSON by default.
