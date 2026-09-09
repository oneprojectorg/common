# `fallow health` artefacts

Committed baselines for `pnpm health`, plus the rules that decide what it
reports and what it fails on.

| file                   | written by            | read by                       |
| ---------------------- | --------------------- | ----------------------------- |
| `health-baseline.json` | `pnpm health:baseline`| `pnpm health` (`--baseline`)  |
| `health-snapshot.json` | `pnpm health:baseline`| `pnpm health:trend`           |
| `crap-trend.json`      | `pnpm health:baseline`| `pnpm health` (summary delta) |

Re-record all three from one full instrumented run:

```bash
pnpm test:coverage    # needs Docker + `pnpm w:api test:supabase:start`
pnpm health:baseline
```

## What CRAP is scored on

CRAP is `complexity² × (1 − coverage)³ + complexity`, so it is only a
measurement where coverage is measured. `scripts/lib/fallow-crap.mjs` scopes it
to instrumented product source — `{apps,packages,services}/*/src/**/*.{ts,tsx}`,
minus test scaffolding — and holds out two workspaces:

- **`apps/app`** — exercised by the Playwright suite in `tests/e2e`, which runs
  against a built Next server with no instrumentation
- **`packages/sense`** — exercised by Storybook only

Unscoped, those two are 296 of the 336 at-risk files and all but one of the
worst twelve. That is a list whose reader learns in thirty seconds that it is mostly
not about testing, and then stops reading it. Instrumenting the e2e build (an
Istanbul build plus `window.__coverage__` collection) is what takes them off the
hold-out list; until then their scores measure the gap in our instrumentation,
not a gap in their tests.

Everything else stays in, including `services/workflows` — no tests at all
there, which is a real finding rather than a measurement gap.

## What fails the run

`pnpm health` exits non-zero when a file **this change touched** scores CRAP 30
or worse. Nothing else about CRAP fails it.

A file already over the line before the change counts too. Separating "you
pushed it up" from "it was already there" needs a CRAP score for the merge base,
which needs a coverage report for the merge base — so the question the gate can
answer honestly is whether the code you just worked on is complex and untested.
Touching it is when you are in a position to fix that.

Changed means: committed since the merge base with `origin/dev`, staged,
unstaged, or untracked. Pass `--base <ref>` to compare against something else.

The repo-wide numbers in the CRAP Summary are a report, not a gate. Gating on
them repo-wide needs a committed per-file baseline, and that artefact has to be
rewritten from a full instrumented run every time anyone improves anything —
a merge conflict on every branch, for a signal the changed-file gate gets
without it. `crap-trend.json` therefore keeps aggregates only.

## Why this is not in CI

A real verdict needs an instrumented run: Docker, the test Supabase, and about
four minutes, most of it the `services/api` suite. `.github/workflows` keeps the
checks that are cheap enough to run on every push. Run `pnpm health` locally
after `pnpm test:coverage`; without a fresh report it says `CRAP: STALE` rather
than reporting a green it cannot back up.
