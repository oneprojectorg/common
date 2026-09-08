/**
 * PROTOTYPE ONLY.
 *
 * Folds the Vite output into one HTML file, twice over:
 *
 * - `dist/index.html` — a standalone document. Open it from disk, mail it, drop
 *   it on any static host.
 * - `dist/artifact.html` — the same page as a body fragment, because the
 *   Artifact host supplies its own doctype, `<html>`, `<head>` and `<body>`.
 *   Everything from `<head>` is hoisted in front of the content: the title, the
 *   Google Fonts links, and the inlined stylesheet.
 *
 * The document is split into head and body *before* anything is inlined. The
 * other way round means running regexes over half a megabyte of bundled code
 * that is full of HTML-looking strings, which silently matches the wrong thing.
 *
 * Plain JS on purpose: a build step that needs its own toolchain is one more
 * thing to install before anyone can share this.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const read = (relative) => readFileSync(join(dist, relative), 'utf8');
const shell = read('index.html');

/*
 * Split on positions, not by searching the whole document: any tag name that
 * appears in a comment or a style block would otherwise be found first, and the
 * head's contents would end up in the body as well.
 */
const headEnd = shell.indexOf('</head>');
const head = shell.slice(shell.indexOf('<head>') + '<head>'.length, headEnd).trim();
const rest = shell.slice(headEnd + '</head>'.length);
const bodyOpen = rest.indexOf('<body');
const body = rest
  .slice(rest.indexOf('>', bodyOpen) + 1, rest.lastIndexOf('</body>'))
  .trim();
const bodyClass = rest.slice(bodyOpen, rest.indexOf('>', bodyOpen)).match(/class="([^"]*)"/)?.[1] ?? '';
const lang = shell.match(/<html[^>]*lang="([^"]*)"/)?.[1] ?? 'en';

const assets = [];
const payloads = new Map();

/**
 * Swaps every built asset reference for an opaque placeholder. The payload is
 * substituted only after all the matching is done — inserting 300 kB of bundled
 * code mid-scan means the next pattern searches the payload too, and a bundle
 * full of HTML-looking strings will match.
 */
const stub = (fragment) =>
  fragment
    .replace(/<script[^>]*src="\/?([^"]+\.js)"[^>]*><\/script>/g, (_m, src) =>
      placeholder(src, (code) => `<script type="module">\n${code}\n</script>`),
    )
    .replace(
      /<link[^>]*rel="stylesheet"[^>]*href="\/?([^"]+\.css)"[^>]*>/g,
      (_m, href) => placeholder(href, (css) => `<style>\n${css}\n</style>`),
    );

function placeholder(asset, wrap) {
  const key = `<!--op-inline-${payloads.size}-->`;

  assets.push(asset);
  payloads.set(key, wrap(read(asset)));

  return key;
}

/** Substitutes the payloads, once, with no further scanning. */
const fill = (fragment) => {
  let out = fragment;

  for (const [key, payload] of payloads) {
    out = out.replace(key, () => payload);
  }

  return out;
};

const inlinedHead = fill(stub(head));
const inlinedBody = fill(stub(body));

writeFileSync(
  join(dist, 'index.html'),
  `<!doctype html>\n<html lang="${lang}" class="h-full">\n<head>\n${inlinedHead}\n</head>\n<body class="${bodyClass}">\n${inlinedBody}\n</body>\n</html>\n`,
);

// The body's own classes have nowhere to live in a fragment, so they move onto a
// wrapper that fills the host's body instead.
writeFileSync(
  join(dist, 'artifact.html'),
  `${inlinedHead}\n<div class="${bodyClass}">\n${inlinedBody}\n</div>\n`,
);

// The separate assets are dead weight now, and leaving them invites shipping a
// half-page that silently fetches nothing.
for (const asset of new Set(assets)) {
  rmSync(join(dist, asset), { force: true });
}

const kb = (name) =>
  `${(readFileSync(join(dist, name)).byteLength / 1024).toFixed(0)} kB`;

console.log(`dist/index.html    ${kb('index.html')}   standalone`);
console.log(`dist/artifact.html ${kb('artifact.html')}   body fragment`);
