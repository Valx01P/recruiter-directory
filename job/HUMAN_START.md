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

## After Cleanup

For a lean app/repo commit, keep the canonical aggregate JSON and workflow code, but do not keep generated run artifacts:

- Keep: `job/recruiter.json`, `recruiter-directory/data/recruiter.json`, `job/scripts`, `job/swarm/sectors`, `job/sectors/manifest.json`.
- Delete/regenerate when needed: `job/sectors/recruiter-*.json`, `job/swarm/codex-sector-state.json`, `job/swarm/codex-sector-logs/*`.
