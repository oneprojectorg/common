#!/usr/bin/env node

/**
 * Script to manage the test Supabase instance
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

const TEST_CONFIG = resolve(process.cwd(), '../..', 'supabase-test.toml');

const COMMANDS = {
  start: 'Start the test Supabase instance',
  stop: 'Stop the test Supabase instance', 
  status: 'Check test Supabase instance status',
  reset: 'Reset the test database',
  logs: 'Show test Supabase logs',
} as const;

type Command = keyof typeof COMMANDS;

function executeSupabaseCommand(cmd: string, description: string) {
  console.log(`🔄 ${description}...`);
  const projectRoot = resolve(process.cwd(), '../..');
  const originalConfig = resolve(projectRoot, 'supabase/config.toml');
  const backupConfig = resolve(projectRoot, 'supabase/config.toml.backup');
  
  try {
    // Backup original config
    execSync(`cp "${originalConfig}" "${backupConfig}"`, { cwd: projectRoot });
    
    // Copy test config to main location
    execSync(`cp "${TEST_CONFIG}" "${originalConfig}"`, { cwd: projectRoot });
    
    // Run the supabase command
    execSync(`supabase ${cmd}`, {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error);
    return false;
  } finally {
    // Restore original config
    try {
      execSync(`cp "${backupConfig}" "${originalConfig}"`, { cwd: projectRoot });
      execSync(`rm "${backupConfig}"`, { cwd: projectRoot });
    } catch (restoreError) {
      console.warn('⚠️ Failed to restore original config:', restoreError);
    }
  }
}

function showHelp() {
  console.log('🧪 Test Supabase Management\n');
  console.log('Usage: tsx supabase-test.ts <command>\n');
  console.log('Available commands:');
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(8)} - ${desc}`);
  });
  console.log('\nTest instance runs on ports 55321-55329 (dev uses 54321-54329)');
}

function main() {
  const command = process.argv[2] as Command;

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  if (!Object.keys(COMMANDS).includes(command)) {
    console.error(`❌ Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  console.log(`🧪 Test Supabase - ${COMMANDS[command]}`);
  console.log(`📁 Config: ${TEST_CONFIG}\n`);

  switch (command) {
    case 'start':
      executeSupabaseCommand('start', 'Starting test Supabase instance');
      break;
    
    case 'stop':
      executeSupabaseCommand('stop', 'Stopping test Supabase instance');
      break;
    
    case 'status':
      executeSupabaseCommand('status', 'Checking test Supabase status');
      break;
    
    case 'reset':
      executeSupabaseCommand('db reset', 'Resetting test database');
      break;
    
    case 'logs':
      executeSupabaseCommand('logs', 'Showing test Supabase logs');
      break;
    
    default:
      console.error(`❌ Command not implemented: ${command}`);
      process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}