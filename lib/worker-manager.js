// lib/worker-manager.js
const storage = require('./storage');
const { runCommand } = require('./job-runner');

let running = true;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function workerLoop(opts = {}) {
  const { id, backoffBase = 2, pollInterval = 1000 } = opts;
  console.log(`Worker ${id} started`);
  while (running) {
    const now = Date.now();
    const job = storage.takeJobForProcessing(now);
    if (!job) {
      await sleep(pollInterval);
      continue;
    }

    console.log(`Worker ${id} picked job ${job.id}: ${job.command}`);
    const attempts = (job.attempts || 0) + 1;

    try {
      const result = await runCommand(job.command, opts.jobTimeoutMs || 60000);
      if (result.code === 0) {
        console.log(`Job ${job.id} completed (code 0).`);
        storage.markCompleted(job.id);
      } else {
        console.log(`Job ${job.id} failed. code=${result.code}, err=${result.error || result.stderr}`);
        if (attempts > job.max_retries) {
          storage.moveToDead(job.id, result.error || result.stderr || `exit:${result.code}`, attempts);
          console.log(`Job ${job.id} moved to DLQ`);
        } else {
          storage.markFailedAndSchedule(job.id, result.error || result.stderr || `exit:${result.code}`, attempts, backoffBase);
          console.log(`Job ${job.id} scheduled for retry (attempt ${attempts})`);
        }
      }
    } catch (err) {
      console.error('Unexpected runner error', err);
      if (attempts > job.max_retries) {
        storage.moveToDead(job.id, err, attempts);
      } else {
        storage.markFailedAndSchedule(job.id, err, attempts, backoffBase);
      }
    }
  }

  console.log(`Worker ${id} stopping gracefully`);
}

function stopAll() {
  running = false;
}

module.exports = { workerLoop, stopAll };
