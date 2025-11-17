/**
 * Global setup for Vitest - runs once before all test files
 * This ensures migrations and seeding happen only once per test run
 */
export async function setup() {
  console.log('🔄 Running Drizzle migrations...');

  // Import necessary modules for running shell commands
  const { execSync } = await import('child_process');
  const path = await import('path');

  // Navigate to project root and run Drizzle migrations
  const projectRoot = path.resolve(process.cwd(), '../..');
  const migrationCommand = 'pnpm w:db migrate:test';

  try {
    execSync(migrationCommand, {
      cwd: projectRoot,
      stdio: 'pipe', // Suppress output unless there's an error
    });

    console.log('✅ Drizzle migrations completed successfully');
  } catch (error: any) {
    console.warn('⚠️  Migration warning:', error.message);
    console.warn(
      '   Tests will continue, but some may fail if schema is outdated',
    );
  }

  // Run seed command after migrations (optional)
  try {
    console.log('🌱 Running database seed...');
    const seedCommand = 'pnpm w:db seed:test';

    execSync(seedCommand, {
      cwd: projectRoot,
      stdio: 'pipe', // Suppress output unless there's an error
    });

    console.log('✅ Database seed completed successfully');
  } catch (seedError: any) {
    // Seeding is optional - don't fail tests if it doesn't work
    console.warn('⚠️  Seeding warning:', seedError.message.split('\n')[0]);
    console.warn('   Tests will continue without seed data');
  }
}

export async function teardown() {
  // Add any global cleanup here if needed
}
