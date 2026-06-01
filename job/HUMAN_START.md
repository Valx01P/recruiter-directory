# Codex Recruiter Swarm

## What This Does

The swarm lets multiple Codex workers populate recruiter data in parallel without editing the same file.

The flow is:

1. Start from the canonical aggregate dataset: `job/recruiter.json`.
2. Build temporary sector work files: `job/sectors/recruiter-*.json`.
3. Launch one worker per sector file.
4. Monitor batches until enough recruiter data is populated.
5. Stop workers and merge sector files back into:
   - `job/recruiter.json`
   - `recruiter-directory/data/recruiter.json`

## File Map

- `job/recruiter.json`: source of truth for the full dataset.
- `recruiter-directory/data/recruiter.json`: bundled copy imported by the Next.js app.
- `job/sectors/recruiter-*.json`: generated sector work files. These can be deleted after a run and rebuilt from `job/recruiter.json`.
- `job/sectors/manifest.json`: small sector map used by the orchestrator.
- `job/swarm/sectors/*.md`: reusable per-sector worker instructions.
- `job/swarm/codex-sector-state.json`: generated runtime state; safe to delete after a run.
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

Stop sends SIGTERM to active workers, waits briefly, then merges `job/sectors/recruiter-*.json` into:

- `job/recruiter.json`
- `recruiter-directory/data/recruiter.json`

Use this only if you intentionally want to stop without merging:

```bash
node job/scripts/codex-sector-orchestrator.js stop --no-merge
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
- Delete/regenerate when needed: `job/sectors/recruiter-*.json`, `job/swarm/codex-sector-state.json`, `job/swarm/codex-sector-logs/*`.
