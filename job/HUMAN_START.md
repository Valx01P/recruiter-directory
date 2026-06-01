# Codex Recruiter Swarm

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

## One-Time Rebuild

```bash
node job/scripts/codex-sector-orchestrator.js init
```

Only run `init` when no workers are active. It rebuilds sector partitions from the canonical recruiter JSON.
