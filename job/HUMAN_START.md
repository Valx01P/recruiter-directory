# Codex Recruiter Swarm

## What This Does

The swarm lets multiple Codex workers populate recruiter data in parallel without editing the same file.

The flow is:

1. Start from the canonical aggregate dataset: `job/recruiter.json`.
2. Build temporary sector work files: `job/sectors/recruiter-*.json`.
3. Launch one worker per sector file.
4. Monitor batches while workers clean broken contacts, enrich opportunity fields, bolster contact lists, and add new companies.
5. Gracefully stop workers, then merge sector files back into:
   - `job/recruiter.json`
   - `recruiter-directory/data/recruiter.json`

## Worker Priorities

Each worker decides what to do inside its own sector partition in this order:

1. Coverage: add missing descriptions and populate empty `recruiters[]` arrays.
2. Link cleanup: repair contacts whose `linkedin_url` is missing or is not a person profile URL. Workers should fill verified profile URLs and preserve existing contacts when a URL cannot be found. Cleanup must not shrink `recruiters[]`; questionable pruning belongs in a separate human-reviewed pass.
3. Opportunity enrichment: fill company-level fields that improve internship/job search.
4. Bolster: add verified recruiters, university recruiters, technical hiring managers, founders, CTOs, VPs/Heads of Engineering, engineering managers, or team leads until the contact target is met.
5. Expansion: add more Miami / South Florida startups and small businesses with technical hiring signals, then other high-signal companies.

Opportunity enrichment fields:

- `company_url`: company homepage.
- `careers_url`: careers, jobs, students, or internships page.
- `early_career_programs`: named internship, university, new-grad, co-op, apprenticeship, fellowship, or rotational programs.
- `application_timeline`: public timing notes for internship/new-grad applications.
- `visa_sponsorship`: public sponsorship/work-authorization evidence; use unknown/varies when evidence is thin.
- `recent_internship_signal`: evidence of recent interns, student roles, or new-grad hiring.
- `opportunity_notes`: concise search/outreach summary.

## File Map

- `job/recruiter.json`: source of truth for the full dataset.
- `recruiter-directory/data/recruiter.json`: bundled copy imported by the Next.js app.
- `job/sectors/recruiter-*.json`: generated sector work files. These can be deleted after a run and rebuilt from `job/recruiter.json`.
- `job/sectors/manifest.json`: small sector map used by the orchestrator.
- `job/swarm/sectors/*.md`: reusable per-sector worker instructions.
- `job/swarm/codex-sector-state.json`: generated runtime state; safe to delete after a run.
- `job/swarm/codex-sector-stop.json`: generated stop request; safe to delete when no workers are active.
- `job/swarm/codex-sector-logs/*`: generated prompts/logs; safe to delete after a run.

## Rebuild Sector Files

Run this before starting a new swarm if `job/sectors/recruiter-*.json` files are missing or stale:

```bash
node job/scripts/codex-sector-orchestrator.js init
```

Only run `init` when no workers are active. It rebuilds sector partitions from the canonical recruiter JSON.

## Start

```bash
node job/scripts/codex-sector-orchestrator.js start
```

This starts one parallel Codex worker per selected sector by default and prints live status.
With no sector arguments, all sectors are worked at the same time.

## Watch It Keep Working

```bash
node job/scripts/codex-sector-orchestrator.js monitor
```

Leave this running when you want new batches to launch as old batches finish.

## Check Status

```bash
node job/scripts/codex-sector-orchestrator.js status
```

Status shows running workers, batch counts, next launch order, and the latest worker error/no-progress warning.

## Stop

```bash
node job/scripts/codex-sector-orchestrator.js stop
```

Stop is graceful by default. It writes `job/swarm/codex-sector-stop.json`, stops new launches, and waits for active workers to finish their current batch/checkpoint before merging `job/sectors/recruiter-*.json` into:

- `job/recruiter.json`
- `recruiter-directory/data/recruiter.json`

Use force only when you intentionally want to interrupt active searches immediately:

```bash
node job/scripts/codex-sector-orchestrator.js stop --force
```

Force stop does not merge because interrupted workers may leave partial sector files. Run `status` and merge manually only after the sector files look right.

Use this only if you intentionally want to stop without merging:

```bash
node job/scripts/codex-sector-orchestrator.js stop --no-merge
```

If a graceful stop times out, active workers are left alive so they can finish without half-written contacts. Run `status`, then run `stop` again after they exit.

## Check Contact Links

New swarm output should not add a saved recruiter/contact without a verified LinkedIn profile URL. To report existing legacy gaps:

```bash
node job/scripts/report-missing-recruiter-links.js
```

To check only one file:

```bash
node job/scripts/report-missing-recruiter-links.js job/sectors/recruiter-cloud.json
```

## Recover Dropped Contacts

If a bad cleanup pass accidentally removes useful contacts, stop the swarm first, then restore missing contacts from the committed canonical JSON into the current sector files:

```bash
node job/scripts/restore-recruiters-from-source.js
node job/scripts/codex-sector-orchestrator.js merge
```

By default, the restore source is `HEAD:job/recruiter.json`. To restore from another local JSON file:

```bash
node job/scripts/restore-recruiters-from-source.js --source path/to/recruiter.json
```

## Refresh Smart Search

Smart search uses Supabase `company_embeddings`, built from `recruiter-directory/data/recruiter.json`.
The deleted sector JSONs and swarm logs are not used by the vector DB.
The frontend and backend gate smart search behind sign-in; CSV export is also a signed-in feature.

After a merge changes the dataset, refresh the vector index:

```bash
cd recruiter-directory
npm run semantic:reindex
```

`semantic:reindex` runs the schema setup, clears old `company_embeddings` rows, and then embeds the bundled data through gte-server. Make sure `../gte-server` is running first and `.env.local` has the Supabase credentials.

If the direct DB connection cannot be reached, paste these SQL files in Supabase SQL Editor:

1. `recruiter-directory/supabase/schema.sql`
2. `recruiter-directory/supabase/reset-company-embeddings.sql`

Then run `cd recruiter-directory && npm run embed`.

If the frontend says smart search is offline, check these in order:

1. `gte-server` is running: `cd gte-server && npm run dev`.
2. The frontend has `NEXT_PUBLIC_GTE_SERVER_URL` set, usually `http://localhost:8787` for local dev.
   In production this is baked into the frontend at build/deploy time, so redeploy the frontend after changing it.
3. `gte-server/.env` has `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
4. The vector index has been populated with `cd recruiter-directory && npm run semantic:reindex`.
5. For a deployed frontend, `gte-server` has `ALLOWED_ORIGINS` set to that frontend origin.

## After Cleanup

For a lean app/repo commit, keep the canonical aggregate JSON and workflow code, but do not keep generated run artifacts:

- Keep: `job/recruiter.json`, `recruiter-directory/data/recruiter.json`, `job/scripts`, `job/swarm/sectors`, `job/sectors/manifest.json`.
- Delete/regenerate when needed: `job/sectors/recruiter-*.json`, `job/swarm/codex-sector-state.json`, `job/swarm/codex-sector-stop.json`, `job/swarm/codex-sector-logs/*`.
