import { execSync } from 'child_process';

try {
  // Get the list of staged changes
  const output = execSync('git diff --cached --name-status').toString();

  // Check for modifications or deletions of .sql files in the migrations directory
  // eslint-disable-next-line regexp/no-unused-capturing-group
  if (/^(D|M)\s+services\/db\/migrations\/.*\.sql$/m.test(output)) {
    console.error(
      'Error: You cannot remove or modify SQL migration files in the "services/db/migrations" directory.',
    );
    process.exit(1); // Exit with error code
  }
} catch (error) {
  console.error('Error executing git command:', (error as Error).message);
  process.exit(1); // Exit with error code if git command fails
}

process.exit(0); // Exit successfully if no issues found
