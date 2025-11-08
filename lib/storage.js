// lib/storage.js  (JSON-backed, simple & safe for single-host assignment)
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const dbFile = path.join(dataDir, 'jobs.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ jobs: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch (e) {
    // recover by creating fresh file
    fs.writeFileSync(dbFile, JSON.stringify({ jobs: [] }, null, 2));
    return { jobs: [] };
  }
}

function save(state) {
  fs.writeFileSync(dbFile, JSON.stringify(state, null, 2));
}

function now() { return Date.now(); }

function init() {
  ensureDataDir();
  const state = load();
  // reclaim stuck processing jobs older than 1 hour
  const stale = now() - 60 * 60 * 1000;
  let changed = false;
  state.jobs.forEach(j => {
    if (j.state === 'processing' && (j.updated_at || 0) < stale) {
      j.state = 'pending';
      j.updated_at = now();
      changed = true;
    }
  });
  if (changed) save(state);
}

function enqueue(job) {
  const state = load();
  const ts = now();
  const j = {
    id: job.id,
    command: job.command,
    state: job.state || 'pending',
    attempts: job.attempts || 0,
    max_retries: job.max_retries || 3,
    run_at: job.run_at || 0,
    created_at: ts,
    updated_at: ts,
    last_error: null
  };
  state.jobs.push(j);
  save(state);
}

function takeJobForProcessing(nowTs) {
  const state = load();
  // pick earliest created pending job that is eligible
  const idx = state.jobs.findIndex(j => j.state === 'pending' && (j.run_at || 0) <= nowTs);
  if (idx === -1) return null;
  // lock it
  const job = state.jobs[idx];
  job.state = 'processing';
  job.updated_at = now();
  save(state);
  // return a shallow copy
  return { id: job.id, command: job.command, attempts: job.attempts, max_retries: job.max_retries };
}

function markCompleted(id) {
  const state = load();
  const j = state.jobs.find(x => x.id === id);
  if (j) { j.state = 'completed'; j.updated_at = now(); save(state); }
}

function markFailedAndSchedule(id, err, attempts, base) {
  const state = load();
  const j = state.jobs.find(x => x.id === id);
  if (!j) return;
  const nextDelayMs = Math.pow(base, attempts) * 1000;
  j.attempts = attempts;
  j.last_error = String(err).slice(0, 2000);
  j.run_at = now() + nextDelayMs;
  j.state = 'pending';
  j.updated_at = now();
  save(state);
}

function moveToDead(id, err, attempts) {
  const state = load();
  const j = state.jobs.find(x => x.id === id);
  if (!j) return;
  j.state = 'dead';
  j.attempts = attempts;
  j.last_error = String(err).slice(0, 2000);
  j.updated_at = now();
  save(state);
}

function listByState(stateName) {
  const state = load();
  return state.jobs.filter(j => j.state === stateName).sort((a,b) => a.created_at - b.created_at);
}

function getStatusSummary() {
  const state = load();
  const summary = {};
  state.jobs.forEach(j => summary[j.state] = (summary[j.state] || 0) + 1);
  return summary;
}

module.exports = { init, enqueue, takeJobForProcessing, markCompleted, markFailedAndSchedule, moveToDead, listByState, getStatusSummary };
