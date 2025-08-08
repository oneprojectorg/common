#!/usr/bin/env node

/**
 * Script to check if local Supabase is running before running integration tests
 */

import { createClient } from '@supabase/supabase-js';

const TEST_SUPABASE_URL = 'http://127.0.0.1:55321';  // Test instance port
const TEST_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function checkSupabase() {
  console.log('🔍 Checking if Supabase is running...');
  
  try {
    const supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
    
    // Try to make a simple request
    const { error } = await supabase.from('_health_check').select('*').limit(1);
    
    // Even if the table doesn't exist, getting a proper error response means Supabase is running
    if (error && (error.message.includes('relation "_health_check" does not exist') || 
                  error.message.includes('relation "public._health_check" does not exist'))) {
      console.log('✅ Supabase is running and accessible');
      console.log(`   URL: ${TEST_SUPABASE_URL}`);
      return true;
    } else if (!error) {
      console.log('✅ Supabase is running and accessible');
      console.log(`   URL: ${TEST_SUPABASE_URL}`);
      return true;
    } else {
      console.error('❌ Supabase responded with unexpected error:', error.message);
      return false;
    }
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      console.error('❌ Cannot connect to Supabase. Is it running?');
      console.log('\nTo start Supabase locally:');
      console.log('  1. Make sure Docker is running');
      console.log('  2. Run: supabase start');
      console.log('  3. Wait for all services to be ready');
    } else {
      console.error('❌ Error connecting to Supabase:', err.message);
    }
    return false;
  }
}

async function runMigrations() {
  console.log('🔄 Running Drizzle migrations...');
  
  try {
    const { execSync } = await import('child_process');
    const path = await import('path');
    
    // Navigate to project root and run Drizzle migrations
    const projectRoot = path.resolve(process.cwd(), '../..');
    const migrationCommand = 'pnpm w:db migrate:test';
    
    execSync(migrationCommand, { 
      cwd: projectRoot,
      stdio: 'inherit' // Show migration output
    });
    
    console.log('✅ Drizzle migrations completed successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

async function main() {
  const shouldRunMigrations = process.argv.includes('--migrations') || process.argv.includes('-m');
  
  const isRunning = await checkSupabase();
  
  if (!isRunning) {
    console.log('\n🚫 Integration tests require a running Supabase instance');
    process.exit(1);
  }
  
  if (shouldRunMigrations) {
    const migrationsSuccessful = await runMigrations();
    if (!migrationsSuccessful) {
      console.log('\n⚠️  Migrations failed, but Supabase is running. Tests may fail if schema is outdated.');
    }
  }
  
  console.log('\n🚀 Ready to run integration tests!');
  process.exit(0);
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}