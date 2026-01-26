#!/usr/bin/env node
/* eslint-disable no-template-curly-in-string */
/* eslint-disable prefer-template */
/**
 * Script to manage the e2e Supabase instance
 * This instance runs on port 56xxx, completely isolated from dev (54xxx) and test (55xxx)
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const E2E_CONFIG = path.resolve(PROJECT_ROOT, 'supabase/supabase-e2e.toml');
const CONFIG_PATH = path.resolve(PROJECT_ROOT, 'supabase/config.toml');

const COMMANDS = {
  start: 'Start the e2e Supabase instance',
  stop: 'Stop the e2e Supabase instance',
  status: 'Check e2e Supabase instance status',
  reset: 'Reset the e2e database',
  logs: 'Show e2e Supabase logs',
  migrate: 'Run migrations on the e2e database',
  seed: 'Seed the e2e database with test data',
} as const;

type Command = keyof typeof COMMANDS;

function executeSupabaseCommand(cmd: string, description: string) {
  console.log(`[e2e] ${description}...`);

  try {
    // Remove symlink/existing config and copy e2e config to config.toml
    execSync(`rm -f "${CONFIG_PATH}"`, { cwd: PROJECT_ROOT });
    execSync(`cp "${E2E_CONFIG}" "${CONFIG_PATH}"`, { cwd: PROJECT_ROOT });

    // Run the supabase command
    execSync(`supabase ${cmd}`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    console.log(`[e2e] ${description} completed`);
    return true;
  } catch (error) {
    console.error(`[e2e] ${description} failed:`, error);
    return false;
  } finally {
    // Restore symlink to dev config
    try {
      execSync(`rm -f "${CONFIG_PATH}"`, { cwd: PROJECT_ROOT });
      execSync(`ln -s supabase-dev.toml config.toml`, {
        cwd: path.resolve(PROJECT_ROOT, 'supabase'),
      });
    } catch (restoreError) {
      console.warn('[e2e] Failed to restore config symlink:', restoreError);
    }
  }
}

function migrateDatabase() {
  console.log('[e2e] Running migrations on e2e database...');

  try {
    execSync(
      'cross-env DB_MIGRATING=true DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres tsx ./migrate.ts',
      {
        cwd: path.resolve(PROJECT_ROOT, 'services/db'),
        stdio: 'inherit',
      },
    );

    console.log('[e2e] Database migrations completed');
    return true;
  } catch (error) {
    console.error('[e2e] Database migrations failed:', error);
    return false;
  }
}

function seedDatabase() {
  console.log('[e2e] Seeding e2e database...');

  try {
    // Run the seed-test.ts script with e2e database URL
    execSync(
      'cross-env DB_SEEDING=true DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres tsx ./seed-test.ts',
      {
        cwd: path.resolve(PROJECT_ROOT, 'services/db'),
        stdio: 'inherit',
      },
    );

    console.log('[e2e] Database seeding completed');
    return true;
  } catch (error) {
    console.error('[e2e] Database seeding failed:', error);
    return false;
  }
}

function showHelp() {
  console.log('E2E Supabase Management\n');
  console.log('Usage: tsx supabase-e2e.ts <command>\n');
  console.log('Available commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(8)} - ${desc}`);
  }
  console.log('\nE2E instance runs on ports 56321-56329');
  console.log('  - Dev uses 54321-54329');
  console.log('  - Test uses 55321-55329');
}

function main() {
  const rawCommand = process.argv[2];

  if (!rawCommand || rawCommand === 'help') {
    showHelp();
    return;
  }

  if (!Object.keys(COMMANDS).includes(rawCommand)) {
    console.error(`[e2e] Unknown command: ${rawCommand}`);
    showHelp();
    process.exit(1);
  }

  const command = rawCommand as Command;

  console.log(`[e2e] ${COMMANDS[command]}`);
  console.log(`Config: ${E2E_CONFIG}\n`);

  switch (command) {
    case 'start':
      executeSupabaseCommand('start', 'Starting e2e Supabase instance');
      break;

    case 'stop':
      executeSupabaseCommand('stop', 'Stopping e2e Supabase instance');
      break;

    case 'status':
      executeSupabaseCommand('status', 'Checking e2e Supabase status');
      break;

    case 'reset':
      executeSupabaseCommand('db reset', 'Resetting e2e database');
      break;

    case 'logs':
      executeSupabaseCommand('logs', 'Showing e2e Supabase logs');
      break;

    case 'migrate':
      migrateDatabase();
      break;

    case 'seed':
      seedDatabase();
      break;

    default:
      console.error(`[e2e] Command not implemented: ${command}`);
      process.exit(1);
  }
}

main();
