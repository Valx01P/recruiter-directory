# HUMAN_START — 8-Grok Recruiter Swarm

**This is the only file you need to read to launch and run the autonomous swarm.**

**Goal**: One script. Eight Grok agents working in parallel on their partitions. The orchestrator auto-feeds "keep going" after every batch and automatically switches them to bolster mode (add more recruiters) only after a partition is 100% covered. No more copy-paste after the initial launch.

---

## The Two Commands That Do Everything

```bash
# 1. Launch the entire swarm (8 background headless Grok processes)
node job/scripts/swarm-orchestrator.js start

# 2. In another terminal tab/window, start the auto-feeder / watcher
node job/scripts/swarm-orchestrator.js monitor
```

Leave the `monitor` running. It will:
- Detect every `BATCH_COMPLETE` marker the agents emit
- Automatically inject the next "continue with your next batch" prompt
- Watch the real JSON files and when any partition hits 0 unpopulated, flip that agent into bolster mode ("now go back and add more people to companies that only have 2-3")

Check progress any time from any terminal:

```bash
node job/scripts/swarm-orchestrator.js status
```

Stop everything cleanly when you need to (dinner, sleep, etc.):

```bash
node job/scripts/swarm-orchestrator.js stop
```

## What Happens Under the Hood

- 8 stable headless sessions are created (`swarm-alpha`, `swarm-beta`, ...).
- Each agent is told once: "Your full rules are in `job/swarm/alpha.md` (etc). Read it with your tools. Work in batches. Emit the exact marker line when a batch is done."
- The monitor watches the session log files for the magic marker strings.
- On seeing a marker (or when it detects via the JSON that a range just completed), it runs `grok -p "the next keep-going or bolster instruction" -s "swarm-alpha"` automatically.
- You only interact with the single orchestrator script.

## The Per-Agent Instruction Files

These are the files the agents themselves read when they need to re-orient:

```
job/swarm/
  alpha.md
  beta.md
  ...
  theta.md
```

They contain your exact rules (min 2-3 then move on, managers/founders for weak signals or small companies, 5-8 min per company, coverage first then bolster, the exact `BATCH_COMPLETE` marker format, status command, edit pattern, etc.).

If you ever want to tweak the rules the agents follow, edit the relevant `.md` file(s) and the next time an agent is injected a "continue" message you can also tell it to re-read its file.

## Bolster Phase (Automatic)

The orchestrator itself computes unpopulated counts from the real JSON files every 90 seconds.

As soon as it sees `unpopulated === 0` for a partition that was still in "coverage" mode, it injects:

> "Your range has reached 0 unpopulated companies. Switch to BOLSTER PHASE immediately. Now go back and add more recruiters (target 5–8 solid entries per company...)"

From that point the agent emits `BOLSTER_BATCH` markers instead, and the orchestrator keeps feeding it.

This is exactly what you described: first fill every company with the minimum viable (2-3), then only after the partition is completely covered do we go back and bolster.

## Graceful Shutdown

`stop` does this for every agent:

1. Injects a short "PAUSE NOW. Finish current company, run merge, print status, then stop."
2. Waits a few seconds.
3. Sends SIGTERM to the background Grok process.

The sessions remain on disk (`~/.grok/sessions/...`), so in theory you could resume them manually later, but the recommended flow is just `start` again when you're ready (it will pick up with fresh context from the current state of the JSON files).

## Files You Care About

- `job/HUMAN_START.md` — this file (the one you're reading)
- `job/scripts/swarm-orchestrator.js` — the only script you run after reading this
- `job/swarm/*.md` — the 8 agent rule files (agents read these themselves via `read_file`)
- `job/swarm/state.json` — tracks PIDs, modes (coverage/bolster), last injection times
- `job/swarm/logs/` — stdout/stderr from each headless Grok (useful for debugging weird behavior)
- `job/recruiter-*.json` — the 8 partition files (never edit by hand)
- `job/scripts/merge-recruiter-partitions.js` — still gets run by the agents after every batch

## Tips

- The monitor prints a tiny status line every 90s with the grand total unpopulated. That's your "is it still making progress?" heartbeat.
- If an agent seems stuck (no marker for a long time), the monitor will eventually send a gentle nudge.
- You can manually force bolster on one agent: `node job/scripts/swarm-orchestrator.js bolster theta`

Run `start` + `monitor` and walk away. The swarm will keep itself fed until the last company in the last partition has been visited at least once (then it will automatically move everyone into the bolster-deepening phase).

When the grand total unpopulated shown by `status` hits zero and all agents are in bolster mode, you're in the endgame.

---

**When in doubt**: just re-read the top of this `job/HUMAN_START.md` file. The two commands are all that matter.
