import { spawn } from 'node:child_process';

const DEFAULT_RUNS = 5;

/**
 * Parse the desired number of runs from the first CLI arg.
 */
function getRunCount() {
  const rawValue = process.argv[2];

  if (!rawValue) {
    return DEFAULT_RUNS;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`Invalid run count: ${rawValue}`);
  }

  return parsedValue;
}

/**
 * Run the root E2E command once and stream output directly.
 */
function runSuite(runNumber, totalRuns) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['e2e'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`Run ${runNumber}/${totalRuns} terminated by signal ${signal}`);
        resolve(false);
        return;
      }

      if (code !== 0) {
        console.error(`Run ${runNumber}/${totalRuns} failed with exit code ${code}`);
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

async function main() {
  const totalRuns = getRunCount();

  console.log(`Repeating E2E suite ${totalRuns} time(s)`);

  for (let runNumber = 1; runNumber <= totalRuns; runNumber += 1) {
    console.log(`\n=== E2E run ${runNumber}/${totalRuns} ===`);

    const passed = await runSuite(runNumber, totalRuns);

    if (!passed) {
      process.exitCode = 1;
      return;
    }
  }

  console.log(`\nAll ${totalRuns} E2E runs passed`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
