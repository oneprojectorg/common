import { execSync } from 'child_process';
import depcheck from 'depcheck';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

// Add this function at the beginning of the file
function checkGitStatus() {
  try {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain').toString().trim();

    if (status) {
      console.error('Error: There are uncommitted changes in the repository.');
      console.error(
        'Please commit or stash your changes before running depCheck.',
        'This prevents accidental commits of partially updated dependency states.',
      );
      process.exit(1);
    }

    // Check for staged files
    const stagedFiles = execSync('git diff --name-only --cached')
      .toString()
      .trim();

    if (stagedFiles) {
      console.error('Error: There are staged files in the repository.');
      console.error(
        'Please commit or unstage your changes before running depCheck.',
        'This prevents accidental commits of partially updated dependency states.',
      );
      process.exit(1);
    }

    console.log('Git status check passed. Proceeding with depCheck...');
  } catch (error) {
    console.error('Error checking Git status:', error);
    process.exit(1);
  }
}

// Function to find directories containing package.json files (one level deep)
function findPackageDirs(dir: string): string[] {
  const results: string[] = [];

  // Check if the directory exists
  if (!fs.existsSync(dir)) {
    console.warn(`Directory does not exist: ${dir}`);

    return results;
  }

  const files = fs.readdirSync(dir);

  console.log(`Files in ${dir}:`, files);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      const packageJsonPath = path.join(filePath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        results.push(path.resolve(filePath));
      }
    }
  }

  return results;
}

// Runs depcheck on a single package directory and removes unused dependencies.
async function runDepcheck(packageDir: string): Promise<void> {
  const options = {
    ignorePatterns: ['dist', 'build'], // Ignore build artifacts
    ignoreMatches: [
      // Ignore dependencies that might be used indirectly (e.g., via config files)
      // or are known false positives for depcheck.
      'postcss', // Used via postcss.config.js
      'autoprefixer', // Used via postcss.config.js
      '@iconify/json', // Used by unplugin-icons
      '@storybook/*', // Used by storybook
    ],
  };

  try {
    const results = await depcheck(packageDir, options);
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    let hasChanges = false;

    if (Object.keys(results.dependencies).length > 0) {
      console.log(`\nRemoving unused dependencies in ${packageDir}:`);
      results.dependencies.forEach((dep) => {
        console.log(`  - ${dep}`);
        delete packageJson.dependencies[dep];
        hasChanges = true;
      });
    }

    if (Object.keys(results.devDependencies).length > 0) {
      console.log(`\nRemoving unused devDependencies in ${packageDir}:`);
      results.devDependencies.forEach((dep) => {
        console.log(`  - ${dep}`);
        delete packageJson.devDependencies[dep];
        hasChanges = true;
      });
    }

    if (hasChanges) {
      // Write the updated package.json back to the file
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`Updated package.json in ${packageDir}`);
    } else {
      console.log(`No unused dependencies found in ${packageDir}`);
    }
  } catch (error) {
    console.error(`Error checking dependencies for ${packageDir}:`, error);
  }
}

// Scans all workspaces, identifies dependencies used in multiple packages,
// and hoists them to the root package.json devDependencies and pnpm.overrides
// to ensure version consistency across the monorepo.
function handleMultiuse() {
  // Read pnpm-workspace.yaml
  const workspaceConfig = yaml.load(
    fs.readFileSync('pnpm-workspace.yaml', 'utf8'),
  ) as { packages: string[] };

  // Get workspace roots
  const workspaceRoots = workspaceConfig.packages.map((glob) =>
    glob.replace('/*', ''),
  );

  // Find package directories in each workspace root
  const packageDirs: string[] = [];

  for (const root of workspaceRoots) {
    packageDirs.push(...findPackageDirs(root));
  }

  // Object to store dependencies, their importing packages, and versions
  const dependencyUsage: {
    [key: string]: { packages: Set<string>; versions: Set<string> };
  } = {};

  // Iterate through each package directory
  for (const packageDir of packageDirs) {
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      name: string;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const packageName = packageJson.name;

    // Combine dependencies and devDependencies
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Add each dependency to the dependencyUsage object
    for (const [dep, version] of Object.entries(allDependencies)) {
      // Skip internal workspace packages
      if (dep.startsWith('@op')) {
        continue;
      }

      if (!dependencyUsage[dep]) {
        dependencyUsage[dep] = { packages: new Set(), versions: new Set() };
      }

      dependencyUsage[dep].packages.add(packageName);
      dependencyUsage[dep].versions.add(version);
    }
  }

  // Filter for dependencies used in 2 or more packages
  const multiuseDependencies = Object.entries(dependencyUsage)

    .filter(([_, { packages }]) => packages.size >= 2)
    .map(([dep, { packages, versions }]) => ({
      dep,
      packages: Array.from(packages),
      versions: Array.from(versions),
    }));

  // Read the root package.json
  const rootPackageJsonPath = path.resolve(
    import.meta.dirname,
    '..',
    'package.json',
  );
  const rootPackageJson = JSON.parse(
    fs.readFileSync(rootPackageJsonPath, 'utf8'),
  ) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    pnpm: { overrides: Record<string, string> };
  };

  // Combine dependencies and devDependencies from root package.json
  const rootDependencies = {
    ...rootPackageJson.dependencies,
    ...rootPackageJson.devDependencies,
  };

  // Ensure pnpm.overrides exists
  if (!rootPackageJson.pnpm) {
    rootPackageJson.pnpm = { overrides: {} };
  }

  if (!rootPackageJson.pnpm.overrides) {
    rootPackageJson.pnpm.overrides = {};
  }

  // Check which multiuse dependencies are not in the root package.json
  const missingInRoot = multiuseDependencies.filter(
    ({ dep }) => !rootDependencies[dep],
  );

  // Add missing dependencies to root package.json and pnpm.overrides
  missingInRoot.forEach(({ dep, versions }) => {
    // Choose the most common version found across workspaces, or the first one if tied.
    const mostCommonVersion = versions.reduce((a, b, _i, arr) =>
      arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length
        ? a
        : b,
    );

    // Ensure devDependencies object exists
    if (!rootPackageJson.devDependencies) {
      rootPackageJson.devDependencies = {};
    }

    // Add the dependency to root devDependencies with the chosen version.
    rootPackageJson.devDependencies[dep] = mostCommonVersion;

    // Add an override to ensure all workspaces use this root version.
    // The `$dep` syntax tells pnpm to use the version of `dep` resolved at the root.
    rootPackageJson.pnpm.overrides[dep] = `$${dep}`;
  });

  // Write updated root package.json
  fs.writeFileSync(
    rootPackageJsonPath,
    JSON.stringify(rootPackageJson, null, 2),
  );

  // Print results
  console.log('Multiuse dependencies:');
  multiuseDependencies.forEach(({ dep, packages, versions }) => {
    const versionString =
      versions.length === 1
        ? versions[0]
        : `Multiple versions: ${versions.join(', ')}`;

    console.log(`${dep} (${versionString}): ${packages.join(', ')}`);
  });

  console.log(
    '\nAdded to root package.json devDependencies and pnpm.overrides:',
  );
  missingInRoot.forEach(({ dep }) => {
    const addedVersion = rootPackageJson.devDependencies[dep];

    console.log(`${dep}: ${addedVersion}`);
  });
}

// Main script execution logic
async function main() {
  // Perform a safety check to ensure no uncommitted/staged changes exist
  checkGitStatus();

  const args = process.argv.slice(2);

  // Handle --multiuse: Hoist shared dependencies to root
  if (args.includes('--multiuse')) {
    console.log(
      'Running in --multiuse mode: Checking for shared dependencies...',
    );
    handleMultiuse();
    console.log('Finished checking shared dependencies.');

    return;
  }

  // Handle --clean: Remove unused dependencies from workspaces
  if (!args.includes('--clean')) {
    console.log('Please specify either --clean or --multiuse flag.');
    process.exit(1);
  }

  console.log('Running in --clean mode: Checking for unused dependencies...');

  // Read pnpm-workspace.yaml
  const workspaceConfig = yaml.load(
    fs.readFileSync('pnpm-workspace.yaml', 'utf8'),
  ) as { packages: string[] };

  console.log(workspaceConfig);

  // Get workspace roots
  const workspaceRoots = workspaceConfig.packages.map((glob) =>
    glob.replace('/*', ''),
  );

  console.log(workspaceRoots);

  // Find package directories in each workspace root
  const packageDirs: string[] = [];

  for (const root of workspaceRoots) {
    packageDirs.push(...findPackageDirs(root));
  }

  // Print the paths of package directories
  console.log('Found package directories:');
  packageDirs.forEach((dir) => console.log(dir));

  // Run depcheck --clean operation on each package directory
  console.log('\nRunning depcheck on each workspace...');

  for (const packageDir of packageDirs) {
    await runDepcheck(packageDir);
  }

  console.log('\nFinished checking unused dependencies.');
}

main().catch((error) => {
  console.error('An error occurred:', error);
  process.exit(1);
});
