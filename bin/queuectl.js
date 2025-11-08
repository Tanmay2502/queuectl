#!/usr/bin/env node
/* bin/queuectl.js - CommonJS, JSON storage friendly */
const { Command } = require('commander');
const program = new Command();
const storage = require('../lib/storage');
const { workerLoop, stopAll } = require('../lib/worker-manager');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

storage.init();

program
  .name('queuectl')
  .description('CLI for queuectl');

program.command('enqueue')
  .description('enqueue a job with JSON payload OR simple command string')
  .argument('<jsonOrCommand...>')
  .option('--max-retries <n>', 'max retries', parseInt, 3)
  .action((jsonOrCommand, opts) => {
    const joined = jsonOrCommand.join(' ');
    let payload;
    try {
      payload = JSON.parse(joined);
    } catch {
      payload = { command: joined };
    }
    const job = {
      id: payload.id || uuidv4(),
      command: payload.command,
      state: 'pending',
      attempts: 0,
      max_retries: payload.max_retries || opts.maxRetries || 3,
      run_at: 0
    };
    storage.enqueue(job);
    console.log('Enqueued job', job.id);
  });

let workerProcesses = [];
program.command('worker:start')
  .description('start workers')
  .option('--count <n>', 'number of workers', parseInt, 1)
  .option('--backoff-base <b>', 'exponential base', parseFloat, 2)
  .action((opts) => {
    const count = opts.count || 1;
    for (let i = 0; i < count; i++) {
      const id = `${process.pid}-${i}`;
      workerProcesses.push((async () => {
        await workerLoop({ id, backoffBase: opts.backoffBase });
      })());
    }

    process.on('SIGINT', async () => {
      console.log('SIGINT received. Stopping workers...');
      stopAll();
      await Promise.all(workerProcesses);
      process.exit(0);
    });

    // keep node process alive if invoked directly
    // (commander will not exit until workerLoops finish)
  });

program.command('status')
  .description('show summary of job states')
  .action(() => {
    console.log(storage.getStatusSummary());
  });

program.command('list')
  .description('list jobs by state')
  .option('--state <s>', 'state to filter (pending|processing|completed|failed|dead)', 'pending')
  .action((opts) => {
    const rows = storage.listByState(opts.state);
    console.table(rows);
  });

program.command('dlq:retry')
  .description('move a dead job back to pending and reset attempts')
  .argument('<id>')
  .action((id) => {
    // Use storage (JSON) API to reset a dead job
    const dead = storage.listByState('dead').find(j => j.id === id);
    if (!dead) return console.error('DLQ job not found');
    // simplistic reset: set state->pending, attempts->0, run_at->0, updated_at updated by storage
    storage.enqueue = storage.enqueue || (() => {}); // dummy guard (shouldn't be needed)
    // We'll directly modify jobs.json via helper: easiest approach is to reuse list and rewrite
    const all = (function(){ 
      const fs = require('fs'); 
      const p = require('path').join(__dirname, '../data/jobs.json'); 
      const data = JSON.parse(fs.readFileSync(p, 'utf8')); 
      const job = data.jobs.find(x => x.id === id && x.state === 'dead');
      if (!job) return null;
      job.state = 'pending';
      job.attempts = 0;
      job.run_at = 0;
      job.updated_at = Date.now();
      fs.writeFileSync(p, JSON.stringify(data, null, 2));
      return job;
    })();
    if (!all) return console.error('DLQ job not found');
    console.log('Job retried', id);
  });

program.parse(process.argv);
