# `@op/vitest-config`

Shared vitest configuration. Currently just coverage, which exists to make
`fallow health` CRAP scores real rather than estimated.

## Usage

```ts
import { coverageConfig } from '@op/vitest-config/coverage';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: coverageConfig(),
  },
});
```

Pass `include` for a workspace whose sources are not under `src/`; it names that
workspace's own files and is extended with the cross-workspace patterns rather
than replacing them. `exclude` is appended to the shared list.

Coverage stays off until `--coverage` is passed, so `pnpm test` is unaffected.
Run the instrumented pass and refresh the merged report from the repo root:

```bash
pnpm test:coverage   # instrumented tests, then merge into coverage/
pnpm health:baseline # rewrite the committed baseline in configs/fallow/
```

`services/api` is the bulk of the suite and needs the isolated test Supabase on
port 55321 (`pnpm w:api test:supabase:start`).

## Integration tests count, and they count everywhere

Our suite is mostly integration tests: `services/api` drives real tRPC
procedures against a real database, and the logic they exercise lives in
`@op/common`. Vitest instruments only the project it runs in unless
`coverage.allowExternal` is set, so those runs used to credit nothing outside
`services/api/src` — `@op/common` read as untested and CRAP scored it as if it
were, while the API layer that merely calls into it looked well covered.

Two settings keep that honest, both in `coverage.ts`:

- `allowExternal: true` instruments modules resolved outside the workspace.
- `include` carries a leading-`**` pattern (`**/src/**/*.{ts,tsx}`) alongside the
  workspace's own. A loaded `@op/common` module relativizes to
  `../../packages/common/src/…`, which only a leading-`**` pattern matches.

Reports therefore overlap on purpose, and `scripts/merge-coverage.mjs` sums the
counters instead of letting the last one read win.

Each workspace still lists its own untouched files at zero coverage — that scan
runs per workspace and is what stops CRAP from silently skipping the code most
at risk. What it does *not* do is invent zeroes for other workspaces: an
external file appears only once some test has loaded it.

### What is still invisible

The Playwright suite in `tests/e2e` runs against a built Next server with no
instrumentation, so a component only exercised end-to-end reads as 0% covered
and carries a CRAP score to match. `packages/sense` (Storybook only) and
`services/workflows` (no tests) are absent from the report for the same reason.
Those numbers are a gap in measurement, not necessarily in testing — read the
`apps/app` and `packages/sense` end of the CRAP list with that in mind.
