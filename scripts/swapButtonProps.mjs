#!/usr/bin/env node
/*
 * Map legacy <Button> / <ButtonLink> props to the new Taki-aligned API.
 *
 * - color="X"   -> variant="Y" (or removed if no equivalent)
 * - size="small" -> size="sm"
 * - size="medium"-> removed
 * - size="inline"-> size="sm" plus className="h-auto p-0"
 * - variant="primary" / "pill" / "icon" -> removed (icon also implies size="icon")
 *
 * `unstyled` is left for manual replacement (replace <Button unstyled> with
 * <UnstyledButton>); flagged via console output so each call site can be
 * reviewed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PROP_REPLACEMENTS = [
  // Color -> variant
  [/\bcolor="primary"/g, 'variant="default"'],
  [/\bcolor="secondary"/g, 'variant="outline"'],
  [/\bcolor="destructive"/g, 'variant="destructive"'],
  [/\bcolor="ghost"/g, 'variant="ghost"'],
  [/\bcolor="neutral"/g, 'variant="outline"'],
  [/\bcolor="unverified"/g, 'variant="outline"'],
  [/\bcolor="verified"/g, 'variant="outline"'],
  [/\bcolor="gradient"/g, ''],
  [/\bcolor="pill"/g, ''],

  // Size renames / drops
  [/\bsize="small"/g, 'size="sm"'],
  [/\bsize="medium"/g, ''],

  // Legacy variant values that no longer exist
  [/\bvariant="primary"/g, ''],
  [/\bvariant="pill"/g, ''],
  [/\bvariant="icon"\s+size="small"/g, 'size="icon-sm"'],
  [/\bvariant="icon"\s+size="default"/g, 'size="icon"'],
  [/\bvariant="icon"\s+size="lg"/g, 'size="icon-lg"'],
  [/\bvariant="icon"/g, 'size="icon"'],

  // Legacy-only style flags Taki Button does not know about
  [/\bsurface="(solid|outline|ghost)"/g, ''],
  [/\bscaleOnPress\b(?!\s*=\s*\{false\})/g, ''],
  [/\binsetShadow\b(?!\s*=\s*\{false\})/g, ''],
  [/\bbackglow\b(?!\s*=\s*\{false\})/g, ''],
];

const files = execSync(`git ls-files '*.tsx' '*.ts'`, {
  encoding: 'utf8',
  cwd: process.cwd(),
})
  .trim()
  .split('\n')
  .filter(Boolean);

let touched = 0;
const flagged = [];

for (const f of files) {
  let src;
  try {
    src = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let out = src;
  for (const [re, repl] of PROP_REPLACEMENTS) {
    out = out.replace(re, repl);
  }

  // Drop the whole line if a prop deletion leaves it as pure whitespace.
  out = out.replace(/^[ \t]+\n/gm, '\n');

  if (out !== src) {
    writeFileSync(f, out);
    touched += 1;
  }

  if (/\bunstyled\b/.test(out) && /from\s+['"]@op\/ui\/Button['"]/.test(out)) {
    flagged.push(f);
  }
}

console.log(`Touched ${touched} files.`);
if (flagged.length) {
  console.log(
    `\nFiles still using <Button unstyled>; replace with <UnstyledButton>:`,
  );
  for (const f of flagged) console.log(`  ${f}`);
}
