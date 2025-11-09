QueueCTL – CLI Based Background Job Queue System

This project was built as part of the Backend Developer Internship Assignment.
It implements a lightweight CLI-based background job queue system called queuectl — built entirely in Node.js using JSON file persistence (no external DB).

The system handles background job execution, retries with exponential backoff, dead-letter queue management, and multiple worker processes — all accessible via simple command-line commands.

🧩 Features

🧠 Job Queue Management – Enqueue and manage background jobs easily.

⚙️ Multiple Worker Support – Run several workers in parallel to process jobs concurrently.

🔁 Retry with Exponential Backoff – Failed jobs are retried automatically with delay = base^attempts seconds.

☠️ Dead Letter Queue (DLQ) – Permanently failed jobs move to DLQ for manual review or retry.

💾 Persistent Storage – All jobs are saved in data/jobs.json and survive restarts.

💬 Simple CLI Interface – Manage everything from the terminal using intuitive commands.

🛠️ Tech Stack

Node.js (CommonJS)

Commander.js for CLI interface

UUID for unique job IDs

JSON-based storage for persistence (simplified alternative to SQLite)

⚙️ Setup Instructions

Clone the repository:

git clone https://github.com/Tanmay2502/queuectl.git
cd queuectl


Install dependencies:

npm install


(Optional) Make the CLI executable globally:

npm link

🚀 Usage Examples
1️⃣ Enqueue a Job
npm run enqueue -- "echo Hello QueueCTL"


Output:

Enqueued job 9b0a3df6-ff29-4a3d-b2c2-5fd324abfabc

2️⃣ Start Worker(s)
npm run worker


or start multiple:

npm run worker:multi


Output:

Worker 12345-0 started
Worker 12345-0 picked job 9b0a3df6... : echo Hello QueueCTL
Job 9b0a3df6... completed (code 0)

3️⃣ Check Queue Status
npm run status


Output:

{ completed: 1, pending: 0, dead: 0 }

4️⃣ View Jobs by State
npm run list -- --state completed
npm run list -- --state pending
npm run list -- --state dead

5️⃣ Retry a Dead Job
npm run dlq:retry -- <job_id>


Output:

Job retried <job_id>

🧠 Architecture Overview
bin/
 └── queuectl.js        → CLI entrypoint (built with commander.js)
lib/
 ├── storage.js         → JSON-backed job storage
 ├── worker-manager.js  → Handles worker lifecycle & job execution
 └── job-runner.js      → Executes shell commands for each job
data/
 └── jobs.json          → Persistent job data (auto-created)


Job Lifecycle:

pending → processing → completed
               ↘
                failed → retried (with exponential backoff)
                              ↘
                               dead (moved to DLQ)

🧪 Testing Instructions

You can validate the system using these test cases:

Test	Expected Outcome
Enqueue + Worker	Job completes successfully
Failed command	Retries 3 times, moves to DLQ
Multiple workers	Process jobs in parallel
Restart app	Jobs persist across restarts
Retry DLQ job	Moves job back to pending

Run example:

npm run enqueue -- "nonexistentcmd"
npm run worker
npm run dlq
npm run dlq:retry -- <job_id>
npm run status

Test Video Link: https://drive.google.com/drive/folders/1oZlBUiDTlmfr1qhSoPbMt35TK7apht3r?usp=sharing

🧾 Assumptions & Trade-offs

Storage: Chose JSON over SQLite for simplicity & portability (no native dependencies).

Concurrency: Workers run sequentially within Node process; suitable for small-scale workloads.

Backoff Base: Default exponential base is 2 (delay = 2^attempts seconds).

Graceful Shutdown: Workers complete current job before stopping on Ctrl+C.

🧍‍♂️ Author

Tanmay Maheshwari
Backend Developer Intern Assignment — QueueCTL
📍 Malaviya National Institute of Technology, Jaipur
💻 Focus: Node.js, MERN Stack, and Systems Design
