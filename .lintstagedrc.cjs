/**
 * The purpose of this file is to configure lint-staged package responsible for linting and formating only the files that have changed. Our linting process consists of 3 steps:
 *
 * 1. Type-check the files that have changed using the TypeScript compiler (tsc)
 * 2. Lint the files that have changed using ESLint
 * 3. Format the files that have changed using Prettier
 *
 * The TypeScript compiler is used to type-check the files that have changed. This is done by running the tsc command with the --noEmit flag. However running tsc on the entire project is not efficient as it would take a long time to run. Instead we only want to run tsc on the files that have changed. In order to do this we need to know which files have changed and which packages they belong to so we can pass their respective tsconfig.json file to the tsc command.
 */

const fs = require('fs');
const path = require('path');

const yaml = require('js-yaml');

const { packages: workspaces } = yaml.load(
  fs.readFileSync('./pnpm-workspace.yaml', 'utf8'),
);

/**
 * A mapping of packages to the files that have changed in that package
 * @type {Object.<string, string[]>} - The key is the absolute path to the package and the value is an array of absolute paths of files that have changed in that package
 */
let packageStagedFiles = {};

const getProjectTSConfig = (stagedFilePath) => {
  // Cleanup workspace names e.g. apps/* --> apps
  const workspaceAbsolutePaths = workspaces.map((val) => {
    return path.join(__dirname, val.replaceAll('/*', ''));
  });

  for (const workspacePath of workspaceAbsolutePaths) {
    if (stagedFilePath.includes(workspacePath)) {
      const packageDirName = stagedFilePath
        .replace(workspacePath)
        .split(path.sep)[1];

      const packagePath = path.join(workspacePath, packageDirName);

      if (workspacePath in packageStagedFiles) {
        packageStagedFiles[packagePath].push(stagedFilePath);
      }
      else {
        packageStagedFiles[packagePath] = [stagedFilePath];
      }

      break;
    }
  }
};

module.exports = {
  '**/*.{ts,tsx}': (val) => {
    packageStagedFiles = {};
    [...val].forEach(getProjectTSConfig);
    const tscCommands = [];
    const eslintCommands = [];

    for (const packagePath in packageStagedFiles) {
      const tsconfigPath = `"${packagePath}/tsconfig.json"`;

      //   const files = mySet1[workspacePath].join(' ');
      tscCommands.push(`pnpm tsc -p ${tsconfigPath} --noEmit`);

      eslintCommands.push(
        `pnpm -C "${packagePath}" exec eslint --fix "${packageStagedFiles[packagePath].join('" "')}"`,
      );
    }

    return [...tscCommands, ...eslintCommands];
  },
  '**/*.{js,jsx,json,css,scss}': (val) => {
    packageStagedFiles = {};
    [...val].forEach(getProjectTSConfig);
    const eslintCommands = [];

    for (const packagePath in packageStagedFiles) {
      eslintCommands.push(
        `pnpm -C "${packagePath}" exec eslint --fix "${val.join('" "')}"`,
      );
    }

    return [...eslintCommands];
  },
};
