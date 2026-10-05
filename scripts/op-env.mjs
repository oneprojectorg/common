#!/usr/bin/env node
/**
 * Run a command with the `.env.local` contents read from one 1Password item.
 *
 * The whole `.env.local` lives in a single 1Password Secure Note. Point
 * `OP_ENV_LOCAL_REF` at its notes field (e.g.
 * `op://Employee/common .env.local/notesPlain`) and this reads it with the
 * 1Password CLI, parses it as a dotenv file, and runs the command with those
 * variables in its environment. Nothing is written to disk.
 *
 * With `OP_ENV_LOCAL_REF` unset the command runs untouched, so anyone keeping
 * a local `.env.local` sees no difference.
 *
 * Variables already set in the shell win over the item, matching how the
 * dotenv loaders treat `.env.local`, so a one-off `FOO=bar pnpm dev` still
 * overrides. For the same reason a root `.env.local` left on disk only fills
 * gaps the item leaves.
 *
 * When injecting it also sets two turbo-facing variables. `TURBO_ENV_MODE`
 * goes loose because strict mode passes a task only the variables listed in
 * `turbo.json`, a filter the `.env.local` loaders never hit because they read
 * the file in-process. `OP_ENV_LOCAL_HASH` stands in for the file turbo's
 * `globalDependencies` would otherwise hash, so editing the item still
 * invalidates cached tasks.
 *
 * Usage: node scripts/op-env.mjs <command> [...args]
 */
import dotenv from 'dotenv';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:os';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/op-env.mjs <command> [...args]');
  process.exit(1);
}

const reference = process.env.OP_ENV_LOCAL_REF;
let injected = {};

if (reference) {
  let contents;
  try {
    contents = execFileSync('op', ['read', reference], {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
    });
  } catch (error) {
    console.error(
      error.code === 'ENOENT'
        ? 'OP_ENV_LOCAL_REF is set but the 1Password CLI (`op`) is not installed: https://developer.1password.com/docs/cli/get-started/'
        : `Could not read ${reference} from 1Password.`,
    );
    process.exit(1);
  }
  injected = {
    ...dotenv.parse(contents),
    TURBO_ENV_MODE: 'loose',
    OP_ENV_LOCAL_HASH: createHash('sha256').update(contents).digest('hex'),
  };
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: { ...injected, ...process.env },
});

// Forward stop signals so a supervisor that signals only this process still
// stops the child.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  process.exit(code ?? 128 + constants.signals[signal]);
});
