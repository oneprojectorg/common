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

**Cognitive complexity, against coverage measured per function:**

```
cognitive² × (1 − coverage)³ + cognitive
```

Cyclomatic complexity counts branches. Cognitive complexity counts what it
costs to hold the function in your head: it charges for nesting depth and
forgives the flat forms, so a twenty-arm `switch` scores 1 while twenty nested
`if`s score far more. Cyclomatic gives those two the same number. Since CRAP
prices the risk of changing code you have to understand first, cognitive is the
multiplier we want, and `scripts/lib/fallow-crap.mjs` computes the score from
fallow's per-function cognitive numbers rather than using its `crap_max`, which
hardcodes cyclomatic.

The coverage term is read straight out of `coverage/coverage-final.json` —
statement coverage over each function's line span, closures included, because
cognitive complexity already charges the outer function for the callbacks it
nests. **This is also not what fallow's own `crap` column reports.** Fallow
name-matches functions onto the Istanbul report, and our house style exports
arrow functions assigned to consts, which istanbul-lib-instrument names
`(anonymous_N)`: 1107 of 13273 functions match, and the other 92% fall back to
its static model, where a function counts as covered if any import path reaches
its file from a test root. That model returns "covered" for anything a test file
can see, which is why `updateProcess.ts` prints a `crap` of 21 — its cyclomatic
complexity exactly, the value CRAP takes at 100% coverage — while its Istanbul
entry shows 1 of 33 statements and 0 of 3 functions ever executed. Matching on
line spans instead is name-independent, so the gate measures all 2004 in-scope
functions the report covers rather than 8% of them.

`pnpm health` prints fallow's file-scores section first and says this inline, so
nobody reads that `crap` column as the one that gates.

### Scope

CRAP is only a measurement where coverage is measured. `scripts/lib/fallow-crap.mjs`
scopes it to instrumented product source — `{apps,packages,services}/*/src/**/*.{ts,tsx}`,
minus test scaffolding — and holds out two workspaces:

- **`apps/app`** — exercised by the Playwright suite in `tests/e2e`, which runs
  against a built Next server with no instrumentation
- **`packages/sense`** — exercised by Storybook only

Unscoped, those two are the overwhelming majority of the at-risk list and all
but one of the worst twelve. That is a list whose reader learns in thirty
seconds that it is mostly not about testing, and then stops reading it.
Instrumenting the e2e build (an Istanbul build plus `window.__coverage__`
collection) is what takes them off the hold-out list; until then their scores
measure the gap in our instrumentation, not a gap in their tests.

Everything else stays in, including `services/workflows` — no tests at all
there, which is a real finding rather than a measurement gap.

A file the coverage report has never heard of is dropped rather than scored as
uncovered: absent from an Istanbul report usually does mean "no test loaded
this", but sometimes it means a workspace did not run, and only one of those
readings is safe to fail a build on. The summary line counts them (36 files,
170 functions at the last recording) so the hole stays visible.

### The bands

`CLEAN` 15 and `AT_RISK` 30 are fallow's own numbers, kept because the anchor
reads just as well in cognitive terms. Bands are easiest to argue about at zero
coverage, where the score collapses to `c² + c`:

| cognitive | CRAP at 0% covered |
| --------- | ------------------ |
| 3         | 12                 |
| 4         | 20                 |
| 5         | 30                 |
| 8         | 72                 |

So `AT_RISK` is "an untested function whose cognitive complexity has reached
5" — a couple of levels of nesting inside a branch, the point where a reader
starts keeping state on their fingers. Coverage buys most of it back: at 50%
covered a function can carry cognitive 15 and still come in under 45, and at
80% covered, under 16. The cube is doing the work, which is the point —
complexity is only a liability where nothing checks it.

## What fails the run

`pnpm health` exits non-zero when a file **this change touched** scores CRAP 30
or worse. Nothing else about CRAP fails it. The verdict names the function that
put each file over the line, with its cognitive score and its measured
coverage, so the next step is a test rather than a hunt.

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
without it. `crap-trend.json` therefore keeps aggregates only, and records the
`metric` it was taken under: `pnpm health` drops the delta rather than
differencing against a trend recorded on a different measure.

## Why this is not in CI

A real verdict needs an instrumented run: Docker, the test Supabase, and about
four minutes, most of it the `services/api` suite. `.github/workflows` keeps the
checks that are cheap enough to run on every push. Run `pnpm health` locally
after `pnpm test:coverage`; without a fresh report it says `CRAP: STALE` rather
than reporting a green it cannot back up — coverage matched by line span goes
wrong in both directions once the file has been edited under it, so a stale
report is worse than none.
