import { execSync } from 'child_process';

const MIGRATION_PATTERN = /^(D|M)\s+services\/db\/migrations\/.*\.sql$/m;
const ERROR_MESSAGE =
  'Error: You cannot remove or modify SQL migration files in the "services/db/migrations" directory.';

function getDiffCommand(): string {
  // In GitHub Actions, compare the PR branch against its base ref so CI can
  // detect modified/deleted migration files that never get "staged" on a runner.
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    return `git diff --name-status origin/${baseRef}...HEAD`;
  }

  // Local/pre-commit context: fall back to the staged diff.
  return 'git diff --cached --name-status';
}

try {
  const output = execSync(getDiffCommand()).toString();

  if (MIGRATION_PATTERN.test(output)) {
    console.error(ERROR_MESSAGE);
    process.exit(1);
  }
} catch (error) {
  console.error('Error executing git command:', (error as Error).message);
  process.exit(1);
}

process.exit(0);
