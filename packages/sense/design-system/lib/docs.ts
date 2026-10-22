import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { CatalogEntry } from './catalog.ts';
import { CONTENT_DIR, SENSE_DIR, isStringRecord, writeFile } from './util.ts';
import type { VerifyResult } from './verify.ts';

/** The folder a component's card lives in; `icons` becomes `Icons`. */
export function cardFolder(entry: CatalogEntry): string {
  return entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
}

export function writeComponentDocs(
  projectDir: string,
  entries: CatalogEntry[],
  verified: VerifyResult,
) {
  const summaries = readSummaries();
  for (const entry of entries) {
    const dir = resolve(projectDir, 'components', cardFolder(entry));
    const height = Math.min(
      4000,
      Math.max(80, verified.cards[entry.name]?.height ?? 300),
    );
    writeFile(resolve(dir, 'preview.html'), previewHtml(entry, height));
    writeFile(resolve(dir, 'README.md'), guide(entry, summaries));
  }
}

/** The `@ds-bundle` header the page reads for the namespace and card order. */
export function bundleHeader(
  entries: CatalogEntry[],
  exports: string[],
): string {
  const names = new Set(exports);
  const components = entries
    .filter((entry) => names.has(entry.name))
    .map((entry) => ({ name: entry.name }));
  return `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: 'Sense', components })} */\n`;
}

/** Declarations for every public module, one section per subpath. */
export function typeDeclarations(
  entries: CatalogEntry[],
  exports: string[],
  tmpDir: string,
): string {
  const outDir = resolve(tmpDir, 'dts');
  execFileSync(
    resolve(SENSE_DIR, 'node_modules/.bin/tsc'),
    [
      '-p',
      'tsconfig.json',
      '--noEmit',
      'false',
      '--declaration',
      '--emitDeclarationOnly',
      '--incremental',
      'false',
      '--rootDir',
      '.',
      '--outDir',
      outDir,
    ],
    { cwd: SENSE_DIR, stdio: 'pipe' },
  );
  const names = new Set(exports);
  const sections = entries.flatMap((entry) => {
    const file = resolve(
      outDir,
      relative(SENSE_DIR, entry.source).replace(/\.tsx?$/, '.d.ts'),
    );
    if (!existsSync(file)) return [];
    const props = entry.exports
      .filter((name) => names.has(name) && /^[A-Z]/.test(name))
      .map(
        (name) =>
          `export type ${name}Props = React.ComponentProps<typeof ${name}>;`,
      );
    return [
      [
        `// ===== @op/sense/${entry.name} → window.Sense =====`,
        readFileSync(file, 'utf8').trim(),
        ...props,
        '',
      ].join('\n'),
    ];
  });
  return [
    '// Types for window.Sense: every named export of @op/sense, one section per subpath.',
    "// Documentation only: imports refer to the package's own dependencies.",
    '',
    ...sections,
  ].join('\n');
}

function previewHtml(entry: CatalogEntry, height: number): string {
  const group = entry.title.split('/')[0] ?? 'Components';
  return `<!-- @dsCard group="${group}" height=${height} -->
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${cardFolder(entry)}</title><style>body{margin:0;padding:16px}</style></head>
<body>
<div id="root"></div>
<script>window.Sense.__renderStories(document.getElementById('root'), ${JSON.stringify(entry.name)});</script>
</body>
</html>
`;
}

function guide(entry: CatalogEntry, summaries: Record<string, string>): string {
  const summary = summaries[entry.name] ?? summaries[cardFolder(entry)];
  const body =
    [summary, entry.doc].filter(Boolean).join('\n\n') ||
    `The ${entry.name} component.`;
  const parts = entry.exports.filter((name) =>
    /^[A-Z]|^use[A-Z]|^toast$/.test(name),
  );
  const shown = parts.slice(0, 6).join(', ') + (parts.length > 6 ? ', …' : '');
  return `# ${cardFolder(entry)}

${body}

**Import (app code):** \`import { ${shown} } from '@op/sense/${entry.name}'\`

**In a prototype:** every part is on \`window.Sense\`: ${parts.map((name) => `\`Sense.${name}\``).join(', ')}.

**Examples** (the Storybook stories under *${entry.title}*): ${entry.stories.join(', ')}.

Source: \`packages/sense/${relative(SENSE_DIR, entry.source)}\`.
`;
}

/** One-line summaries for components whose source has no JSDoc. */
function readSummaries(): Record<string, string> {
  const parsed: unknown = JSON.parse(
    readFileSync(resolve(CONTENT_DIR, 'summaries.json'), 'utf8'),
  );
  if (!isStringRecord(parsed)) {
    throw new Error('content/summaries.json must map names to strings');
  }
  return parsed;
}
