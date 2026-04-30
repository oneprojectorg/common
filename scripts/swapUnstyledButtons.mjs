#!/usr/bin/env node
import { execSync } from 'node:child_process';
/*
 * Convert <Button unstyled ...> -> <UnstyledButton ...>.
 * Updates the @op/ui/Button import to include UnstyledButton.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const files = execSync(`git ls-files '*.tsx'`, {
  encoding: 'utf8',
  cwd: process.cwd(),
})
  .trim()
  .split('\n')
  .filter(Boolean);

let touched = 0;

for (const f of files) {
  let src;
  try {
    src = readFileSync(f, 'utf8');
  } catch {
    continue;
  }

  if (!/from\s+['"]@op\/ui\/Button['"]/.test(src)) continue;
  if (!/<Button\b[^>]*\bunstyled\b/.test(src)) continue;

  let out = src;

  // <Button unstyled ...> / </Button>  -> <UnstyledButton ...> / </UnstyledButton>
  out = out.replace(
    /<Button(\s+[^>]*?\bunstyled\b[^>]*?)>([\s\S]*?)<\/Button>/g,
    (_m, attrs, inner) => {
      const cleanedAttrs = attrs.replace(/\s+unstyled\b/, '');
      return `<UnstyledButton${cleanedAttrs}>${inner}</UnstyledButton>`;
    },
  );

  // self-closing variant
  out = out.replace(/<Button(\s+[^>]*?\bunstyled\b[^>]*?)\/>/g, (_m, attrs) => {
    const cleanedAttrs = attrs.replace(/\s+unstyled\b/, '');
    return `<UnstyledButton${cleanedAttrs}/>`;
  });

  // Update import
  out = out.replace(
    /import\s+\{([^}]*)\}\s+from\s+(['"])@op\/ui\/Button\2/g,
    (_m, names, q) => {
      const list = names
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      if (!list.includes('UnstyledButton')) list.push('UnstyledButton');
      return `import { ${list.join(', ')} } from ${q}@op/ui/Button${q}`;
    },
  );

  if (out !== src) {
    writeFileSync(f, out);
    touched += 1;
  }
}

console.log(`Touched ${touched} files`);
