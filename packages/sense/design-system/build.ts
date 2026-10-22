// Builds the Sense design system (the Claude Design System artifact) from
// @op/sense and @op/styles. See README.md beside this file.
//
//   pnpm w:sense design-system [--out <dir>] [--chromium <path>] [--screenshots]
import { cpSync, readdirSync, rmSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { buildBundle, buildReactLibraries } from './lib/bundle.ts';
import { readCatalog } from './lib/catalog.ts';
import {
  bundleHeader,
  typeDeclarations,
  writeComponentDocs,
} from './lib/docs.ts';
import { buildStylesheet } from './lib/styles.ts';
import { buildTokens, tokenNames, tokensCss } from './lib/tokens.ts';
import { CONTENT_DIR, DESIGN_SYSTEM_DIR, log, writeFile } from './lib/util.ts';
import { verify } from './lib/verify.ts';

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: resolve(DESIGN_SYSTEM_DIR, 'out') },
    chromium: { type: 'string' },
    screenshots: { type: 'boolean', default: false },
  },
});

const outDir = resolve(args.out);
const projectDir = resolve(outDir, 'project');
const tmpDir = resolve(outDir, '.tmp');
rmSync(outDir, { recursive: true, force: true });

log('1/6 Reading components and stories');
const catalog = readCatalog();
log(`    ${catalog.entries.length} components`);

log('2/6 Tokens and fonts');
const tokens = buildTokens(projectDir);
writeFile(
  resolve(projectDir, 'tokens.json'),
  `${JSON.stringify(tokens, null, 1)}\n`,
);
writeFile(resolve(projectDir, 'tokens.css'), tokensCss(tokens));

log('3/6 Bundling components');
const bundle = await buildBundle(catalog, tmpDir);
const react = await buildReactLibraries();
writeFile(
  resolve(projectDir, 'components/lib/react.production.min.js'),
  react.react,
);
writeFile(
  resolve(projectDir, 'components/lib/react-dom.production.min.js'),
  react.reactDom,
);

log('4/6 Compiling styles');
writeFile(
  resolve(projectDir, 'components/bundle.css'),
  buildStylesheet(tokenNames(tokens), bundle.css, tmpDir),
);
// Header-less for the check; the header needs the export list it produces.
writeFile(resolve(projectDir, 'components/bundle.js'), bundle.js);

log('5/6 Rendering every preview in Chromium');
const screenshotDir = args.screenshots
  ? resolve(outDir, 'screenshots')
  : undefined;
const verified = await verify(projectDir, catalog.entries, {
  executablePath: args.chromium,
  screenshotDir,
});
rmSync(resolve(projectDir, '.verify.html'), { force: true });

log('6/6 Writing guides, previews and types');
writeFile(
  resolve(projectDir, 'components/bundle.js'),
  bundleHeader(catalog.entries, verified.exports) + bundle.js,
);
writeComponentDocs(projectDir, catalog.entries, verified);
writeFile(
  resolve(projectDir, 'components/index.d.ts'),
  typeDeclarations(catalog.entries, verified.exports, tmpDir),
);
// The brand book, cover and asset notes are written by people; copy as-is.
cpSync(resolve(CONTENT_DIR, 'project'), projectDir, { recursive: true });
rmSync(tmpDir, { recursive: true, force: true });

const failures = Object.entries(verified.cards).filter(
  ([, card]) => card.errors.length,
);
const files = listFiles(projectDir);
writeFile(
  resolve(outDir, 'report.json'),
  `${JSON.stringify(
    {
      ref: tokens.meta.ref,
      components: catalog.entries.map((entry) => entry.name),
      exports: verified.exports.length,
      clashes: verified.clashes,
      failures: Object.fromEntries(
        failures.map(([name, card]) => [name, card.errors]),
      ),
      blockedRequests: Object.fromEntries(
        Object.entries(verified.cards)
          .filter(([, card]) => card.blocked.length)
          .map(([name, card]) => [name, card.blocked.length]),
      ),
      files,
    },
    null,
    2,
  )}\n`,
);

log('');
log(`${files.length} files in ${relative(process.cwd(), projectDir)}`);
log(
  `${verified.exports.length} exports on window.Sense, ${verified.clashes.length} name clashes`,
);
if (screenshotDir)
  log(`Screenshots in ${relative(process.cwd(), screenshotDir)}`);
if (failures.length) {
  log(`\n${failures.length} components failed to render:`);
  for (const [name, card] of failures)
    log(`  ${name}: ${card.errors.join(' | ')}`);
  process.exitCode = 1;
} else {
  log('Every preview rendered.');
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => statSync(resolve(dir, file)).isFile())
    .sort();
}
