// scripts/test-flow.js
const { execSync } = require('child_process');

function run(cmd) {
  console.log('->', cmd);
  try {
    console.log(execSync(cmd, { encoding: 'utf8' }));
  } catch (e) {
    console.error(e.stdout || e.message);
  }
}

run('node ./bin/queuectl.js enqueue {"id":"job-ok","command":"echo done && sleep 1","max_retries":3}');
run('node ./bin/queuectl.js enqueue {"id":"job-bad","command":"nonexistentcommand","max_retries":2}');
console.log('Start workers in a separate terminal: npm run worker or npm run worker:multi');
console.log('Then check status: npm run status');
