# Codex Recruiter Swarm

## Start

```bash
node job/scripts/codex-sector-orchestrator.js start
```

This starts up to 12 parallel Codex workers by default and prints live status.
Workers are assigned to the best available sector partition: never-started and empty recruiter partitions first, then missing descriptions, then under-10-contact sectors, then expansion.

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
- `recruiter-directory/public/data/recruiter.json`

Use this only if you intentionally want to stop without merging:

```bash
node job/scripts/codex-sector-orchestrator.js stop --no-merge
```

## One-Time Rebuild

```bash
node job/scripts/codex-sector-orchestrator.js init
```

Only run `init` when no workers are active. It rebuilds sector partitions from the canonical recruiter JSON.
