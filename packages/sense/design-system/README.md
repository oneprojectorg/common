# Sense design system build

This folder builds **Sense**, the Claude Design System artifact that lets the
design team prototype with the real `@op/sense` components in Claude Design.

```bash
pnpm w:sense design-system                # build into design-system/out/
pnpm w:sense design-system --screenshots  # also save a PNG of every preview
pnpm w:sense design-system --chromium /path/to/chrome
```

The command writes `out/project/`, the artifact's files, and `out/report.json`.
It exits with code 1 when a preview fails to render.

## What it builds

| Step | Input | Output in `out/project/` |
| --- | --- | --- |
| Catalog | `package.json#exports` and every `*.stories.tsx` | the component list |
| Tokens | `packages/styles/tokens.css`, `theme.css`, the Fontsource packages | `tokens.json`, `tokens.css`, `fonts/` |
| Bundle | every component and story, through esbuild | `components/bundle.js`, `components/lib/` (React) |
| Styles | `theme.css` through Tailwind, token variables removed | `components/bundle.css` |
| Check | the bundle in headless Chromium, network blocked | preview heights, `report.json` |
| Docs | component JSDoc, `content/summaries.json`, TypeScript declarations | `components/<Name>/README.md`, `preview.html`, `index.d.ts` |

`content/project/` holds the files that people write: the brand book
(`README.md`), the cover and the asset notes. The build copies them as they
are.

## How the bundle works

- `bundle.js` puts every named export of `@op/sense` on `window.Sense`. The name
  is the same as in the app: `@op/sense/Button` gives `Sense.Button`.
- React comes from `components/lib/`, built from the repo's own React. React 19
  has no browser build.
- Each preview renders the component's Storybook stories, in file order, through
  `preview-runtime.tsx`. Stories do not run their `play()` tests.
- `tokens.css` is the only source of token values. `bundle.css` keeps no token
  variable, so a value that changes on the artifact page reaches the components.

## Keep it current

- Give every composite a JSDoc block. The guide uses it.
- For a component with no JSDoc (most primitives), add one sentence to
  `content/summaries.json`.
- Edit the brand book in `content/project/README.md`, not on the artifact page.
  The next build replaces the page's copy.

## Publish

A Claude session publishes `out/project/` to the Sense artifact with the
Artifact tool. Plain CI cannot publish.

1. Run the build and confirm that it reports no failures.
2. Read the artifact's `project/design-system.json`.
3. Publish the changed files from `out/project/` to the artifact. Send `null`
   for each component folder that the artifact has and `report.json` does not.
4. Send `design-system.json` last. Keep every key and set `lastChange`.

Icons and logos are uploads in the artifact's asset store. The build does not
change them.

## Requirements

- Dependencies installed for `@op/sense` and `@op/styles`.
- Playwright's Chromium (`pnpm w:sense exec playwright-core install chromium`), or `--chromium`
  with the path to a Chrome or Chromium build.
