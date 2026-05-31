#!/usr/bin/env node
/**
 * swarm-orchestrator.js
 *
 * The one script you actually run.
 *
 * Manages 8 parallel headless Grok sessions (one per partition) that autonomously
 * populate recruiter data. The script:
 *   - Launches them with stable reusable session IDs
 *   - Watches for BATCH_COMPLETE / RANGE_COMPLETE markers
 *   - Auto-injects "keep going" / "bolster" prompts so you never have to copy-paste
 *   - Detects when a range hits 0 unpopulated and flips that agent into bolster mode
 *   - Handles clean start / status / monitor / stop
 *
 * Usage:
 *   node job/scripts/swarm-orchestrator.js start
 *   node job/scripts/swarm-orchestrator.js monitor     # foreground watcher that auto-feeds
 *   node job/scripts/swarm-orchestrator.js status
 *   node job/scripts/swarm-orchestrator.js stop
 *   node job/scripts/swarm-orchestrator.js bolster theta
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const JOB_DIR = path.join(ROOT, "job");
const SWARM_DIR = path.join(JOB_DIR, "swarm");
const STATE_FILE = path.join(SWARM_DIR, "state.json");
const LOG_DIR = path.join(SWARM_DIR, "logs");

const GROK_BIN = "/Users/pvaldes/.grok/bin/grok";

const AGENTS = [
  { key: "alpha",   name: "Alpha",   num: 1, file: "recruiter-alpha.json",   start: "C0001", end: "C0157" },
  { key: "beta",    name: "Beta",    num: 2, file: "recruiter-beta.json",    start: "C0158", end: "C0314" },
  { key: "gamma",   name: "Gamma",   num: 3, file: "recruiter-gamma.json",   start: "C0315", end: "C0471" },
  { key: "delta",   name: "Delta",   num: 4, file: "recruiter-delta.json",   start: "C0472", end: "C0627" },
  { key: "epsilon", name: "Epsilon", num: 5, file: "recruiter-epsilon.json", start: "C0628", end: "C0783" },
  { key: "zeta",    name: "Zeta",    num: 6, file: "recruiter-zeta.json",    start: "C0784", end: "C0939" },
  { key: "eta",     name: "Eta",     num: 7, file: "recruiter-eta.json",     start: "C0940", end: "C1095" },
  { key: "theta",   name: "Theta",   num: 8, file: "recruiter-theta.json",   start: "C1096", end: "C1251" },
];

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { agents: {} };
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.mkdirSync(SWARM_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getUnpopulatedCount(agent) {
  const fpath = path.join(JOB_DIR, agent.file);
  const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
  const inRange = data.companies.filter(c => c.id >= agent.start && c.id <= agent.end);
  return inRange.filter(c => !c.recruiters || c.recruiters.length === 0).length;
}

function getPopulatedStats(agent) {
  const fpath = path.join(JOB_DIR, agent.file);
  const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
  const inRange = data.companies.filter(c => c.id >= agent.start && c.id <= agent.end);
  const pop = inRange.filter(c => c.recruiters && c.recruiters.length > 0).length;
  const totalRecs = inRange.reduce((s, c) => s + (c.recruiters || []).length, 0);
  return { total: inRange.length, populated: pop, unpopulated: inRange.length - pop, totalRecs };
}

function buildInitialPrompt(agent) {
  const stats = getPopulatedStats(agent);
  const mdPath = `job/swarm/${agent.key}.md`;

  return `You are now Agent ${agent.name} in a fully autonomous recruiter population swarm.

Your permanent operating instructions live in the file ${mdPath}.
Read that file (using the read_file tool) right now at the beginning of this session.

Current live state of YOUR partition:
- Range: ${agent.start}–${agent.end}
- Companies in range: ${stats.total}
- Already populated: ${stats.populated}
- Still unpopulated: ${stats.unpopulated}
- Total recruiters currently in your file: ${stats.totalRecs}

You are running in a long-lived headless session managed by an orchestrator script.
The orchestrator will watch for the special marker lines you emit and automatically feed you the next instructions so you can keep working without human intervention.

Rules (summary — full details in ${mdPath}):
- Minimum 2–3 solid entries per company, then move on. Do not over-hunt for 10.
- For weak signals: managers, engineering leads, founders at small companies are valid.
- 5–8 minutes max research per company on average.
- Batches of 10–18 companies.
- After every batch: edits (only your file) → merge script → fresh status → emit the exact marker:

  === BATCH_COMPLETE ${agent.name} <num-companies> <entries-added> <unpop-remaining> ===

- Then immediately start the next batch.

If the orchestrator detects your range has reached 0 unpopulated, it will inject a message telling you to switch to BOLSTER phase (go back and deepen the entries).

First actions:
1. Run the exact status command that is documented in ${mdPath} (the big node -e one).
2. Re-read ${mdPath} if you want the full rules in context.
3. Pick 12–16 unpopulated companies from your range.
4. Begin research + editing.

Emit the BATCH_COMPLETE marker at the end of every batch so the orchestrator can keep you moving.

You now have the tools, the rules file, and the autonomy. Start working.`;
}

function launchAgent(agent, state) {
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const sessionId = `swarm-${agent.key}`;
  const logFile = path.join(LOG_DIR, `${agent.key}.log`);
  const prompt = buildInitialPrompt(agent);

  // Write prompt to a temp file so we don't blow up the command line
  const promptFile = path.join(LOG_DIR, `${agent.key}-initial-prompt.txt`);
  fs.writeFileSync(promptFile, prompt, "utf8");

  const args = [
    "-p", `cat ${promptFile} | head -c 8000`,   // safety — the prompt is long, better to have it read the file inside
    "-s", sessionId,
    "--yolo",
    "--max-turns", "1500",
    "--output-format", "json"
  ];

  // Actually, for very long autonomous runs we want the agent to receive the full instructions.
  // Better approach: put the "you are autonomous, read the md file" in a short prompt, and let the agent read the .md itself on first turn.
  const shortLaunch = `You are Agent ${agent.name} in the recruiter swarm (range ${agent.start}–${agent.end}).

Your complete rules, status command, batch marker format, and phase instructions are in the file job/swarm/${agent.key}.md — read it with the read_file tool immediately.

Current unpopulated in your range: ${getUnpopulatedCount(agent)}.

Run the status command from that file, then begin autonomous batches of 10-18 companies.
At the end of every batch emit exactly:
=== BATCH_COMPLETE ${agent.name} <count> <added> <remaining-unpop> ===

The orchestrator is watching and will auto-feed you "continue" messages.
Start now.`;

  const child = spawn(GROK_BIN, ["-p", shortLaunch, "-s", sessionId, "--yolo", "--max-turns", "2000", "--output-format", "json"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const out = fs.createWriteStream(logFile, { flags: "a" });
  child.stdout.pipe(out);
  child.stderr.pipe(out);

  child.unref();

  state.agents[agent.key] = {
    sessionId,
    pid: child.pid,
    launchedAt: new Date().toISOString(),
    mode: "coverage",
    lastBatchMarker: null,
    unpopWhenLaunched: getUnpopulatedCount(agent)
  };

  console.log(`  Launched ${agent.name} (pid ${child.pid}, session ${sessionId})`);
  return child.pid;
}

function injectPrompt(agentKey, text) {
  const state = loadState();
  const info = state.agents[agentKey];
  if (!info) {
    console.error(`No state for ${agentKey}`);
    return false;
  }
  const sessionId = info.sessionId;

  try {
    const cmd = `${GROK_BIN} -p ${JSON.stringify(text)} -s ${sessionId} --yolo --max-turns 80 --output-format json >> ${path.join(LOG_DIR, agentKey + ".log")} 2>&1`;
    execSync(cmd, { cwd: ROOT, stdio: "ignore" });
    console.log(`  [inject] ${agentKey}: ${text.slice(0, 70)}...`);
    return true;
  } catch (e) {
    console.error(`  Failed to inject into ${agentKey}:`, e.message);
    return false;
  }
}

function cmdStart() {
  console.log("=== Starting 8-agent recruiter swarm ===\n");

  const state = { agents: {} };

  AGENTS.forEach(agent => {
    const pid = launchAgent(agent, state);
    // small stagger so they don't all hammer the API at the exact same microsecond
    const ms = 1200 + Math.random() * 800;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  });

  saveState(state);
  console.log("\n✅ Swarm launched. State saved to job/swarm/state.json");
  console.log("Run `node job/scripts/swarm-orchestrator.js monitor` in another terminal to watch and auto-feed.");
}

function cmdStatus() {
  const state = loadState();
  console.log("=== Recruiter Swarm Status ===\n");

  AGENTS.forEach(agent => {
    const stats = getPopulatedStats(agent);
    const info = state.agents[agent.key] || {};
    const alive = info.pid ? isProcessAlive(info.pid) : false;

    const pct = ((stats.populated / stats.total) * 100).toFixed(1);
    console.log(`${agent.name.padEnd(8)}  ${stats.populated}/${stats.total} (${pct}%)  unpop:${stats.unpopulated.toString().padStart(3)}  recs:${stats.totalRecs.toString().padStart(4)}  |  mode:${(info.mode || "n/a").padEnd(9)}  alive:${alive ? "yes" : "no "}`);
  });

  const totalUnpop = AGENTS.reduce((s, a) => s + getUnpopulatedCount(a), 0);
  console.log(`\nGrand total still unpopulated: ${totalUnpop}`);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function cmdStop() {
  const state = loadState();
  console.log("=== Stopping swarm (graceful where possible) ===\n");

  AGENTS.forEach(agent => {
    const info = state.agents[agent.key];
    if (!info || !info.pid) return;

    if (isProcessAlive(info.pid)) {
      // Best effort: try to tell the agent to pause and merge
      injectPrompt(agent.key, "PAUSE NOW. Finish your current company if mid-research, run the merge script, print your range status, then stop all work. Output a final status.");

      // Give it a couple seconds
      execSync("sleep 3");

      try {
        process.kill(info.pid, "SIGTERM");
        console.log(`  Sent SIGTERM to ${agent.name} (pid ${info.pid})`);
      } catch (e) {
        console.log(`  ${agent.name} already gone`);
      }
    } else {
      console.log(`  ${agent.name} not running`);
    }
  });

  // Clear pids but keep history
  Object.values(state.agents).forEach(a => { a.pid = null; });
  saveState(state);
  console.log("\nSwarm stopped. Sessions are still on disk and can be resumed later if needed.");
}

function scanForMarkers(agentKey) {
  const logFile = path.join(LOG_DIR, `${agentKey}.log`);
  if (!fs.existsSync(logFile)) return [];

  const content = fs.readFileSync(logFile, "utf8");
  const re = /=== (BATCH_COMPLETE|BOLSTER_BATCH|RANGE_COMPLETE) ([A-Za-z]+) ([^=]+) ===/g;
  const matches = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    matches.push({
      type: m[1],
      agent: m[2],
      rest: m[3].trim(),
      ts: Date.now()
    });
  }
  return matches;
}

function cmdMonitor() {
  console.log("=== Swarm Monitor (auto-feed) running. Ctrl-C to exit ===\n");
  console.log("This process watches the 8 agents, detects batch completions via markers,");
  console.log("checks actual unpopulated counts, and automatically injects 'continue' or 'bolster' prompts.\n");

  const state = loadState();

  const interval = setInterval(() => {
    let didSomething = false;

    AGENTS.forEach(agent => {
      const info = state.agents[agent.key];
      if (!info) return;

      const currentUnpop = getUnpopulatedCount(agent);
      const markers = scanForMarkers(agent.key);

      // 1. Range complete detection → switch to bolster
      if (currentUnpop === 0 && info.mode === "coverage") {
        console.log(`[${new Date().toISOString().slice(11,19)}] ${agent.name} range now 0 unpopulated → switching to BOLSTER`);
        injectPrompt(agent.key,
          "Your range has reached 0 unpopulated companies. Switch to BOLSTER PHASE immediately.\n\n" +
          "Now go back through companies in your range and add more recruiters (target 5–8 solid entries per company where possible, still preferring university/early-career/SWE focused).\n" +
          "Continue working in batches of 8–12 companies. Emit BOLSTER_BATCH markers instead.\n" +
          "When you have done a full pass, report and keep going deeper on the companies that still have the fewest entries.\n\n" +
          "Read job/swarm/" + agent.key + ".md for the exact bolster rules if needed."
        );
        info.mode = "bolster";
        didSomething = true;
      }

      // 2. Recent BATCH_COMPLETE marker → auto-continue
      const latestMarker = markers[markers.length - 1];
      if (latestMarker && latestMarker.ts > (info.lastInjected || 0) + 30 * 1000) {
        if (latestMarker.type === "BATCH_COMPLETE" || latestMarker.type === "BOLSTER_BATCH") {
          console.log(`[${new Date().toISOString().slice(11,19)}] ${agent.name} emitted ${latestMarker.type} → auto-feeding next batch`);
          const continueText = latestMarker.type === "BOLSTER_BATCH"
            ? "Good bolster batch. Continue immediately with the next 8–12 companies in bolster mode (deepen entries on companies that still have fewer than 5–6 recruiters)."
            : "Good batch. Continue immediately with your next batch of 10–18 companies following the exact same rules (min 2-3 then move on, managers/founders for weak signals, etc.). Emit the BATCH_COMPLETE marker when done.";

          injectPrompt(agent.key, continueText);
          info.lastInjected = Date.now();
          didSomething = true;
        }
      }

      // 3. Stale agent nudge (no marker in a long time while still having work)
      if (currentUnpop > 0 && info.lastInjected && (Date.now() - info.lastInjected) > 25 * 60 * 1000) {
        console.log(`[${new Date().toISOString().slice(11,19)}] ${agent.name} has been quiet >25min with ${currentUnpop} unpop → gentle nudge`);
        injectPrompt(agent.key, "You have been working for a while. Please continue with the next batch now. Remember the speed rules and emit the marker when the batch is complete.");
        info.lastInjected = Date.now();
        didSomething = true;
      }

      // Update live unpop in state for visibility
      info.currentUnpop = currentUnpop;
    });

    if (didSomething) {
      saveState(state);
    }

    // Periodic summary line
    const totalUnpop = AGENTS.reduce((s, a) => s + getUnpopulatedCount(a), 0);
    process.stdout.write(`\r[${new Date().toISOString().slice(11,19)}] Total unpopulated across swarm: ${totalUnpop}   `);
  }, 90 * 1000); // every 90 seconds

  // Keep the process alive
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n\nMonitor stopped. The background Grok processes are still running (use 'stop' to kill them).");
    process.exit(0);
  });
}

function cmdBolster(agentKey) {
  if (!AGENTS.find(a => a.key === agentKey)) {
    console.error("Unknown agent. Use one of: " + AGENTS.map(a => a.key).join(", "));
    return;
  }
  injectPrompt(agentKey, "Switch to BOLSTER PHASE now. Re-read job/swarm/" + agentKey + ".md for the bolster rules, then start deepening entries on companies that have the fewest recruiters so far.");
  console.log("Bolster directive sent to " + agentKey);
}

function main() {
  const cmd = process.argv[2] || "help";

  if (cmd === "start") return cmdStart();
  if (cmd === "status") return cmdStatus();
  if (cmd === "stop") return cmdStop();
  if (cmd === "monitor") return cmdMonitor();
  if (cmd === "bolster") return cmdBolster(process.argv[3]);

  console.log(`
Recruiter Swarm Orchestrator

Commands:
  start     Launch all 8 headless Grok agents (backgrounded, stable sessions)
  monitor   Foreground watcher that auto-detects batch markers and injects "keep going"
  status    Live view of populated/unpopulated counts + process health
  stop      Graceful shutdown (tells agents to pause + merge, then kills)
  bolster <key>   Manually force one agent into bolster mode (e.g. bolster theta)

Examples:
  node job/scripts/swarm-orchestrator.js start
  node job/scripts/swarm-orchestrator.js monitor
  node job/scripts/swarm-orchestrator.js status
  node job/scripts/swarm-orchestrator.js stop
`);
}

main();
