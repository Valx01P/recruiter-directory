#!/usr/bin/env node
/**
 * Reserve globally unique company IDs for sector expansion.
 *
 * Usage:
 *   node job/scripts/allocate-company-ids.js 3
 *
 * The script scans canonical + sector files, then reserves the next C#### IDs
 * under a lock so concurrent sector workers do not collide.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const JOB_DIR = path.join(ROOT, "job");
const SECTOR_DIR = path.join(JOB_DIR, "sectors");
const STATE_FILE = path.join(SECTOR_DIR, "id-allocation.json");
const LOCK_FILE = path.join(SECTOR_DIR, "id-allocation.lock");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(fn) {
  fs.mkdirSync(SECTOR_DIR, { recursive: true });
  const started = Date.now();
  let fd = null;
  while (Date.now() - started < 30000) {
    try {
      fd = fs.openSync(LOCK_FILE, "wx");
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      sleep(150);
    }
  }
  if (fd === null) throw new Error(`Timed out waiting for ${LOCK_FILE}`);

  try {
    return fn();
  } finally {
    fs.closeSync(fd);
    fs.rmSync(LOCK_FILE, { force: true });
  }
}

function readJsonIfExists(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function maxCompanyNumber() {
  const ids = [];
  const canonical = readJsonIfExists(path.join(JOB_DIR, "recruiter.json"), { companies: [] });
  ids.push(...(canonical.companies || []).map((company) => company.id));

  if (fs.existsSync(SECTOR_DIR)) {
    for (const name of fs.readdirSync(SECTOR_DIR)) {
      if (!/^recruiter-.+\.json$/.test(name)) continue;
      const data = readJsonIfExists(path.join(SECTOR_DIR, name), { companies: [] });
      ids.push(...(data.companies || []).map((company) => company.id));
    }
  }

  let max = 0;
  for (const id of ids) {
    const match = /^C(\d+)$/.exec(String(id || ""));
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

function main() {
  const count = Number(process.argv[2] || "1");
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    console.error("Usage: node job/scripts/allocate-company-ids.js <count 1-50>");
    process.exit(1);
  }

  const ids = withLock(() => {
    const state = readJsonIfExists(STATE_FILE, { last_number: 0, reservations: [] });
    const start = Math.max(Number(state.last_number || 0), maxCompanyNumber()) + 1;
    const reserved = Array.from({ length: count }, (_, i) => `C${String(start + i).padStart(4, "0")}`);
    const nextState = {
      last_number: start + count - 1,
      updated_at: new Date().toISOString(),
      reservations: [
        ...(state.reservations || []),
        { ids: reserved, reserved_at: new Date().toISOString() },
      ].slice(-200),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2) + "\n");
    return reserved;
  });

  console.log(ids.join("\n"));
}

main();
