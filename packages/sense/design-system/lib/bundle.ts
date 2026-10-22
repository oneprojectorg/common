import esbuild from 'esbuild';
import type { BuildOptions, Plugin } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Catalog } from './catalog.ts';
import {
  DESIGN_SYSTEM_DIR,
  SENSE_DIR,
  STYLES_DIR,
  isRecord,
  isStringRecord,
  writeFile,
} from './util.ts';

// The bundle reads React from `window.React` / `window.ReactDOM`, which the two
// library files below provide. JSX compiles against a runtime shimmed over
// `createElement`, so the bundle never carries a second React.
const SHIMS: Record<string, string> = {
  react: 'module.exports = window.React;',
  'react-dom': 'module.exports = window.ReactDOM;',
  'react-dom/client': 'module.exports = window.ReactDOM;',
  'react/jsx-runtime': jsxShim(),
  'react/jsx-dev-runtime': jsxShim(),
  // Stories import test helpers for their play() functions; a preview never
  // runs them, and the real module drags in a 600 KB formatter.
  'storybook/test': `var noop = function () { var f = function () {}; f.mockName = function () { return f; }; f.mockImplementation = function () { return f; }; return f; };
var stub = new Proxy(function () { return stub; }, { get: function () { return stub; }, apply: function () { return stub; } });
module.exports = { fn: noop, spyOn: noop, expect: stub, within: stub, userEvent: stub, fireEvent: stub, waitFor: stub, screen: stub };`,
};

function jsxShim() {
  return `var R = window.React;
function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : Object.assign({}, props, { key: key })); }
module.exports = { jsx: jsx, jsxs: jsx, jsxDEV: jsx, Fragment: R.Fragment };`;
}

const COMMON: BuildOptions = {
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
    global: 'window',
  },
};

export interface BundleResult {
  js: string;
  /** CSS that components import directly (e.g. MapLibre's stylesheet). */
  css: string;
}

export async function buildBundle(
  catalog: Catalog,
  tmpDir: string,
): Promise<BundleResult> {
  const entry = resolve(tmpDir, 'entry.tsx');
  writeFile(entry, entrySource(catalog));

  const result = await esbuild.build({
    ...COMMON,
    entryPoints: [entry],
    outdir: tmpDir,
    entryNames: 'bundle',
    write: false,
    jsx: 'automatic',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl' },
    plugins: [resolveForBrowser()],
  });

  const output = (ext: string) =>
    result.outputFiles.find((file) => file.path.endsWith(ext))?.text ?? '';
  const js = output('.js');
  // The bundle is inlined into <script> elements by consumers.
  if (/<\/script|<!--/i.test(js)) {
    throw new Error('bundle.js contains </script or <!--');
  }
  return { js, css: output('.css') };
}

/** React 19 ships no browser build, so build the two globals from the repo's copy. */
export async function buildReactLibraries() {
  const build = async (contents: string, plugins: Plugin[] = []) => {
    const result = await esbuild.build({
      ...COMMON,
      stdin: { contents, resolveDir: SENSE_DIR, loader: 'js' },
      write: false,
      plugins,
    });
    return result.outputFiles[0]?.text ?? '';
  };
  const reactFromGlobal: Plugin = {
    name: 'react-from-global',
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({
        path: 'react',
        namespace: 'shim',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
        contents: SHIMS.react,
        loader: 'js',
      }));
    },
  };
  const pkg: unknown = JSON.parse(
    readFileSync(resolve(SENSE_DIR, 'node_modules/react/package.json'), 'utf8'),
  );
  return {
    version:
      isRecord(pkg) && typeof pkg.version === 'string' ? pkg.version : '',
    react: await build(`window.React = require('react');`),
    reactDom: await build(
      `window.ReactDOM = Object.assign({}, require('react-dom'), require('react-dom/client'));`,
      [reactFromGlobal],
    ),
  };
}

function entrySource(catalog: Catalog) {
  const files = [...new Set(Object.values(catalog.subpaths))];
  const lines = [
    `import { register } from ${JSON.stringify(resolve(DESIGN_SYSTEM_DIR, 'preview-runtime.tsx'))};`,
    ...files.map(
      (file, i) => `import * as m${i} from ${JSON.stringify(file)};`,
    ),
    ...catalog.entries.map(
      (entry, i) => `import * as s${i} from ${JSON.stringify(entry.story)};`,
    ),
    `register({${files.map((_, i) => `m${i}: m${i}`).join(', ')}}, {${catalog.entries
      .map(
        (entry, i) =>
          `${JSON.stringify(entry.name)}: { module: s${i}, order: ${JSON.stringify(entry.stories)} }`,
      )
      .join(', ')}});`,
  ];
  return lines.join('\n');
}

function resolveForBrowser(): Plugin {
  const pkg: unknown = JSON.parse(
    readFileSync(resolve(SENSE_DIR, 'package.json'), 'utf8'),
  );
  const exports =
    isRecord(pkg) && isStringRecord(pkg.exports) ? pkg.exports : {};
  const shimmed = new RegExp(
    `^(${Object.keys(SHIMS)
      .map((name) => name.replace(/[/-]/g, '\\$&'))
      .join('|')})$`,
  );
  return {
    name: 'resolve-for-browser',
    setup(builder) {
      builder.onResolve({ filter: shimmed }, (args) => ({
        path: args.path,
        namespace: 'shim',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'shim' }, (args) => ({
        contents: SHIMS[args.path] ?? '',
        loader: 'js',
      }));
      // Stories import through the public subpath (`@op/sense/Button`).
      builder.onResolve({ filter: /^@op\/sense\// }, (args) => {
        const target = exports[`./${args.path.slice('@op/sense/'.length)}`];
        return target
          ? { path: resolve(SENSE_DIR, target) }
          : { errors: [{ text: `No @op/sense export for ${args.path}` }] };
      });
      builder.onResolve({ filter: /^@op\/styles\/constants$/ }, () => ({
        path: resolve(STYLES_DIR, 'constants.ts'),
      }));
    },
  };
}
