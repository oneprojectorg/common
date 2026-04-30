#!/usr/bin/env node
/*
 * Phase B: swap OP brand Tailwind classes to shadcn-token classes.
 *
 * Order matters: longer / more specific patterns must run before
 * their prefixes (e.g. text-primary-tealBlack before text-primary-teal).
 *
 * Targets: tracked .ts/.tsx/.css/.mdx files under apps/, packages/,
 * services/, excluding node_modules and dist.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const REPLACEMENTS = [
  // Primary / teal — longest first
  ['primary-tealBlack', 'primary'],
  ['primary-tealWhite', 'primary-foreground'],
  ['primary-teal', 'primary'],
  ['teal-50', 'primary/10'],
  ['teal-100', 'primary/20'],
  ['teal-200', 'primary/30'],
  ['teal-300', 'primary/50'],
  ['teal-400', 'primary/70'],
  ['teal-500', 'primary'],
  ['teal-600', 'primary'],
  ['teal-700', 'primary'],

  // Bare teal
  ['text-teal', 'text-primary'],
  ['bg-teal', 'bg-primary'],
  ['border-teal', 'border-primary'],
  ['fill-teal', 'fill-primary'],
  ['stroke-teal', 'stroke-primary'],
  ['outline-teal', 'outline-primary'],
  ['ring-teal', 'ring-primary'],

  // Destructive / red
  ['functional-redBlack', 'destructive'],
  ['functional-redWhite', 'destructive-foreground'],
  ['functional-red', 'destructive'],
  ['text-red\\b', 'text-destructive'],
  ['bg-red\\b', 'bg-destructive'],
  ['border-red\\b', 'border-destructive'],

  // Positive / green
  ['functional-greenWhite', 'positive-foreground'],
  ['functional-green', 'positive'],
  ['status-green-bg', 'positive/10'],
  ['status-greenBg', 'positive/10'],
  ['status-green', 'positive'],
  ['text-green\\b', 'text-positive'],
  ['bg-green\\b', 'bg-positive'],
  ['border-green\\b', 'border-positive'],

  // Warning / yellow
  ['functional-yellowWhite', 'warning-foreground'],
  ['primary-yellow', 'warning'],
  ['primary-orange1', 'warning'],
  ['primary-orange2', 'warning'],

  // Data viz
  ['data-blue', 'chart-3'],
  ['data-purple', 'chart-1'],

  // Neutrals (text)
  ['text-neutral-black', 'text-foreground'],
  ['text-neutral-charcoal', 'text-foreground'],
  ['text-charcoal', 'text-foreground'],
  ['text-neutral-gray4', 'text-muted-foreground'],
  ['text-darkGray', 'text-muted-foreground'],
  ['text-neutral-gray3', 'text-muted-foreground'],
  ['text-midGray', 'text-muted-foreground'],
  ['text-neutral-gray2', 'text-muted-foreground/70'],
  ['text-lightGray', 'text-muted-foreground/70'],
  ['text-neutral-gray1', 'text-muted'],
  ['text-neutral-offWhite', 'text-muted'],
  ['text-offWhite', 'text-muted'],
  ['text-whiteish', 'text-background'],

  // Neutrals (bg)
  ['bg-neutral-black', 'bg-foreground'],
  ['bg-neutral-charcoal', 'bg-foreground'],
  ['bg-charcoal', 'bg-foreground'],
  ['bg-neutral-gray4', 'bg-foreground/80'],
  ['bg-darkGray', 'bg-foreground/80'],
  ['bg-neutral-gray3', 'bg-muted-foreground'],
  ['bg-midGray', 'bg-muted-foreground'],
  ['bg-neutral-gray2', 'bg-muted-foreground/30'],
  ['bg-lightGray', 'bg-muted-foreground/30'],
  ['bg-neutral-gray1', 'bg-accent'],
  ['bg-neutral-offWhite', 'bg-muted'],
  ['bg-offWhite', 'bg-muted'],
  ['bg-whiteish', 'bg-background'],

  // Borders
  ['border-neutral-gray1', 'border-border'],
  ['border-neutral-gray2', 'border-input'],
  ['border-neutral-gray3', 'border-input'],
  ['border-neutral-gray4', 'border-input'],
  ['border-darkGray', 'border-input'],
  ['border-lightGray', 'border-input'],
  ['border-neutral-offWhite', 'border-border'],
  ['border-offWhite', 'border-border'],
  ['border-charcoal', 'border-foreground'],

  // Outline
  ['outline-offWhite', 'outline-border'],

  // Stroke / fill
  ['stroke-charcoal', 'stroke-foreground'],
  ['fill-charcoal', 'fill-foreground'],
  ['fill-offWhite', 'fill-background'],

  // Decoration
  ['decoration-neutral-gray4', 'decoration-muted-foreground'],

  // Suffix-only sweeps (catch any remaining compound prefixes like
  // border-b-, from-, to-, stroke-, hover:, group-hover:, etc.).
  // Order matters within these too — longest first.
  ['neutral-charcoal', 'foreground'],
  ['neutral-black', 'foreground'],
  ['neutral-gray1', 'accent'],
  ['neutral-gray2', 'muted-foreground/70'],
  ['neutral-gray3', 'muted-foreground'],
  ['neutral-gray4', 'foreground/80'],
  ['neutral-offWhite', 'muted'],
  ['neutral-gray0', 'accent'], // typo seen in a few places
];

import { existsSync } from 'node:fs';

const files = execSync(
  `git ls-files '*.ts' '*.tsx' '*.css' '*.mdx'`,
  { encoding: 'utf8', cwd: process.cwd() },
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((f) => existsSync(f))
  .filter(
    (f) =>
      !f.includes('node_modules') &&
      !f.includes('packages/styles/tokens.css') &&
      !f.includes('packages/styles/shadcn-theme.css') &&
      !f.includes('packages/styles/shared-styles.css') &&
      !f.includes('packages/styles/tw-animate.css') &&
      !f.includes('scripts/swapTokens.mjs') &&
      !f.includes('packages/ui/src/components/ui/'), // Taki primitives already shadcn-classed
  );

let touched = 0;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let out = src;
  for (const [needle, repl] of REPLACEMENTS) {
    const re = new RegExp(needle.includes('\\b') ? needle : escapeRegex(needle), 'g');
    out = out.replace(re, repl);
  }
  if (out !== src) {
    writeFileSync(f, out);
    touched += 1;
  }
}

function escapeRegex(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

console.log(`Touched ${touched} files`);
