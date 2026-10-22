import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import postcss, { AtRule, Rule } from 'postcss';

import { DESIGN_SYSTEM_DIR, REPO_DIR, STYLES_DIR, writeFile } from './util.ts';

/**
 * Tailwind over packages/styles/theme.css, scanning only the design system,
 * with every variable tokens.json declares removed: tokens.css is their one
 * source, so a value edited on the Design System page reaches the components.
 */
export function buildStylesheet(
  tokenNames: Set<string>,
  componentCss: string,
  tmpDir: string,
): string {
  const input = resolve(tmpDir, 'tailwind-input.css');
  const output = resolve(tmpDir, 'tailwind.css');
  writeFile(
    input,
    [
      `@import '${resolve(STYLES_DIR, 'theme.css')}';`,
      `@source not '${resolve(REPO_DIR, 'apps/app/src')}';`,
      `@source '${resolve(DESIGN_SYSTEM_DIR, 'preview-runtime.tsx')}';`,
      '',
    ].join('\n'),
  );

  const require = createRequire(resolve(STYLES_DIR, 'package.json'));
  const cli = resolve(
    dirname(require.resolve('@tailwindcss/cli/package.json')),
    'dist/index.mjs',
  );
  execFileSync(process.execPath, [cli, '-i', input, '-o', output, '--minify'], {
    cwd: STYLES_DIR,
    stdio: 'pipe',
  });

  const root = postcss.parse(readFileSync(output, 'utf8'));
  root.walkDecls((decl) => {
    const rule = decl.parent;
    if (!decl.prop.startsWith('--') || !(rule instanceof Rule)) return;
    if (!rule.selector.includes(':root')) return;
    // The 768px block re-sizes the type scale; it is not a token.
    if (rule.parent instanceof AtRule && rule.parent.name === 'media') return;
    if (tokenNames.has(decl.prop.slice(2))) decl.remove();
  });
  root.walkRules((rule) => {
    if (!rule.nodes.length) rule.remove();
  });

  return [
    '/* Sense: @op/styles theme.css compiled by Tailwind for @op/sense. Token values come from tokens.css. */',
    root.toString(),
    componentCss,
  ].join('\n');
}
