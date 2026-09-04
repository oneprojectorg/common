#!/usr/bin/env node
/**
 * Ensure a Redis is listening for the e2e stack, starting one if it isn't.
 *
 * The proposals export keeps its status in `@op/cache`, and that cache is
 * Redis-only: `set` returns silently when `REDIS_URL` is unset, and `get`
 * answers null. Nothing errors. The export is accepted, the workflow writes a
 * status nobody stores, and the browser waits out its timeout before reporting
 * a failure for a file that exists. So a missing Redis does not degrade the
 * e2e run, it makes one feature quietly untestable.
 *
 * This runs from `start:e2e` rather than from the CI workflow because the e2e
 * workflow triggers on `pull_request_target`: GitHub runs the workflow file
 * from the base branch, so a service added on a feature branch does not exist
 * until it merges. `package.json` is checked out from the pull request, so a
 * preflight here takes effect on the branch that adds it.
 *
 * It also has to run before the servers, not beside them: `@op/cache` builds
 * its client at module load and stops reconnecting after three attempts, so a
 * Redis that appears later is never picked up.
 *
 * An already-listening Redis is left alone. That keeps this a no-op once the
 * base branch grows a real service container, and stops a second container
 * fighting the first for the port.
 */
import { execFileSync } from 'node:child_process';
import { connect } from 'node:net';

const PORT = Number(process.env.E2E_REDIS_PORT ?? 6380);
const HOST = '127.0.0.1';
const CONTAINER = 'op-redis-e2e';
const IMAGE = 'redis:7-alpine';

/** Resolves true when something accepts a TCP connection on the port. */
const isListening = () =>
  new Promise((resolve) => {
    const socket = connect({ host: HOST, port: PORT });
    const settle = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });

const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8' }).trim();

if (await isListening()) {
  console.log(`[e2e] Redis already listening on ${HOST}:${PORT}`);
  process.exit(0);
}

try {
  run('docker', ['rm', '-f', CONTAINER]);
} catch {
  // No leftover container from an earlier run; nothing to remove.
}

console.log(`[e2e] starting Redis on ${HOST}:${PORT} (${CONTAINER})`);

try {
  run('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-p',
    `${PORT}:6379`,
    IMAGE,
  ]);
} catch (error) {
  console.error(
    `[e2e] could not start Redis. The e2e stack needs Docker, which it ` +
      `already requires for Supabase.\n${error.message ?? error}`,
  );
  process.exit(1);
}

// Poll rather than sleep: the container reports started before redis-server
// accepts connections, and a fixed wait is either too short or wasted.
const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  if (await isListening()) {
    console.log(`[e2e] Redis ready on ${HOST}:${PORT}`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

console.error(`[e2e] Redis did not accept connections on ${HOST}:${PORT}`);
process.exit(1);
