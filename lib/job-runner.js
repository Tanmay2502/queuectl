// lib/job-runner.js
const { spawn } = require('child_process');

function runCommand(command, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    let timedOut = false;
    const t = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(t);
      if (timedOut) {
        return resolve({ code: null, signal: 'SIGKILL', stdout, stderr, error: 'timeout' });
      }
      resolve({ code, signal, stdout, stderr });
    });

    child.on('error', err => {
      clearTimeout(t);
      resolve({ code: null, error: String(err), stdout, stderr });
    });
  });
}

module.exports = { runCommand };
