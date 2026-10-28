# Award budget demos (PR #2403)

Scripted walkthroughs of the award-budget feature in a visible
browser, driven by `agent-browser batch`. Each recipe creates its own
test data, drives the UI, reads the rows back from the local database,
and leaves the browser open on the last screen.

## Prerequisites

- The local stack: app on `localhost:3100`, API on `localhost:3300`,
  Supabase on `127.0.0.1:54321` (database on `54322`).

- `.env.local` at the repo root with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`.

- `just`, `agent-browser`, `psql`, `node` on the PATH. The seed step
- runs `tsx` through the `@op/e2e` workspace, so `pnpm install` must
- have run.  The branch of PR #2403 checked out, because the app on
- `:3100` serves the working tree.

## Walkthrough: the whole demo, start to finish

Every step below is one command typed in this folder. Pick a label for
the session (`demo1` here); every recipe uses it, so cleanup finds
everything at the end.

### 0. Check the ground

```
just status
```

Expected: no rows. If rows show, a previous run was not cleaned up:
`just cleanup` (no label) removes every demo row.

### 1. Builder: where the budget comes from

```
just builder demo1
```

What you see: a browser window opens, logs in as a fresh admin, opens
the Create menu, starts a draft process and lands on Process
Settings. The script types 25000 into **Total budget**, waits for
"Saved at", turns on **Hide the total budget from members**, then
reloads the page. The terminal prints one line per batch step; the two `eval` lines end
with the values read from the reloaded page, and the read-back line
comes from the database:

```
✓ eval (l => 'Total budget after reload: ' + … -> Total budget after reload: 25000
✓ eval 'Hide budget after reload: ' + … -> Hide budget after reload: true

Read-back from the local database (draft decision-…):
hideBudget=true | submission={"budget": 25000} ; final=-
```

The budget sits in the first phase's `settings`, next to
`config.hideBudget`. Look at the window as long as
needed; the next step closes it.

### 2. Selection table: the budget at work

```
just selection demo1
```

What you see: the terminal prints `→ seeding …` (a published decision
in its final phase, four proposals: Alpha $5,000, Beta $8,000, Gamma
$2,500, Euro €4,000, phase budget $12,000), then the browser logs in
as that decision's admin and opens the "Confirm the winning proposals"
table. Then, in order, with a screenshot of each state:

1. Advance Alpha and Beta → the footer reads "$13,000 of $12,000 allocated", "Over budget by $1,000", Confirm disabled.
2. Advance Euro → the footer reads "The awards use more than one currency…", Confirm disabled; Euro is un-advanced again.
3. Alpha's award set to 0 → "Enter an amount greater than 0" under the field, Confirm disabled.
4. Alpha 3000, Beta 9000 → "$12,000 of $12,000 allocated", Confirm enabled.
5. Confirm → the read-only amounts dialog → Continue → "Advance without notifying" → "Results are live!".

The terminal ends with the stored allocations:

```
Proposal Alpha | 3000
Proposal Beta | 9000
```

and the three `confirm disabled …` evals print `true`, `true`, `false`. The browser stays on the results page.

### 3. Member view: what hideBudget hides

```
just member demo1
```

No browser interaction: the script seeds a second decision with
`hideBudget` on and calls `decision.getInstance` over the API
twice. Expected:

```
admin (admin=true): submission=null ; final={"budget":12000}
member (admin=false): submission=null ; final={"budget":null}
```

The admin keeps the budget; the member does not get it.

### 4. Look at the screenshots

```
just screenshots
```

`builder-1-*`, `builder-2-*`, `selection-1-*` … `selection-7-*` are
the states above, in order. They are overwritten on the next run.

### 5. Clean up

```
just cleanup demo1
just status
```

Expected after cleanup: `remaining: users=0 orgs=0`, `browser closed`,
and `just status` prints nothing.

### The same in one command

```
just all
```

Runs steps 1–3 with the labels `all-builder`, `all-selection`,
`all-member`, then cleans each up. Use it to re-check everything after
a code change; use the step-by-step order above when you want to look
at the screens.

## Recipes

Run them from this folder, or from anywhere with `just --justfile
<this folder>/Justfile --working-directory <this folder> <recipe>`.

| Recipe | What it does | Runtime |
|---|---|---|
| `just builder [label]` | Creates an admin user, opens the Create menu, starts a draft process, fills **Total budget** (`BUDGET`, default 25000), flips **Hide the total budget from members**, reloads, reads both back from the page and from `decision_process_instances`. | about 30 s |
| `just selection [label]` | Seeds a published decision in its final phase with four proposals (three USD, one EUR) and a phase budget (`BUDGET`, default 12000). Logs in as its admin and drives the selection table: over budget, mixed currency, empty award, within budget, confirm dialog, "Advance without notifying", results. Reads the stored allocations back. | about 2 min |
| `just member [label]` | Seeds a hidden-budget decision and calls `decision.getInstance` over the API as the admin and as a member. Prints each viewer's phase settings. | about 20 s |
| `just seed [label] [budget] [hide]` | Seeds only. Prints the seed JSON (users, password, instance, proposals, cleanup ids). | about 10 s |
| `just cleanup [label]` | Deletes the users, organizations, decisions and drafts of one label (no label: of every run), removes the session files, closes the browser. | seconds |
| `just all` | Runs the three demos with their own labels, then cleans each up. | about 3 min |
| `just status` | Lists demo users and demo profiles still in the local database. | |
| `just screenshots` | Opens this folder. | |

A label names one session. `builder`, `selection` and `member` can share a label (the member demo seeds under `<label>-member`), and `just cleanup <label>` removes everything the three created. Two runs of the same recipe with the same label overwrite each other's files, so start a new label for a new session.

## What to expect on screen

Each script prints one `→` line before a silent stage (seeding,
opening the browser, running the batch). The batch prints nothing
until it ends, then one line per step:

```
✓ find role button click --name Advance Proposal Alpha -> {"clicked":"@e1"}
✗ wait --text Over budget by -> ERROR Wait timed out after 90000ms
```

A `✗` stops the batch (`--bail`); the read-back and the cleanup hint
still print. The browser stays open on the last screen so the state
can be inspected. `just cleanup <label>` closes it.

Expected read-backs:

- builder: `hideBudget=true | submission={"budget": 25000} ; final=-`
- selection: `Proposal Alpha | 3000` and `Proposal Beta | 9000`; the three `confirm disabled …` evals read `true`, `true`, `false`
- member: `admin (admin=true): … final={"budget":12000}` and `member (admin=false): … final={"budget":null}`

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `BUDGET` | 25000 (builder), 12000 (selection, member) | the amount typed or seeded |
| `HIDE_BUDGET` | `false` | `selection`: seed with `hideBudget` on |
| `AGENT_BROWSER_DEFAULT_TIMEOUT` | 90000 | every browser action, in ms; raise it on a cold dev server |

## Files

| File | Role |
|---|---|
| `Justfile` | the recipes |
| `demo-builder.sh`, `demo-selection.sh`, `demo-member.sh` | one script per recipe; each writes `batch-<label>.json` (the commands) and `batch-<label>.result.json` (the results) |
| `seed.sh` | wraps `tests/e2e/scripts/seed-award-demo.ts` with the dev-database environment; writes `seed-<label>.json` |
| `session.ts` | signs a seeded user in by password and writes `cookies-<label>.json` |
| `mkuser.ts`, `rmusers.ts` | create and delete auth users through the Supabase admin API (builder only) |
| `cleanup-demo.sh` | deletes everything a label created |
| `*.png` | screenshots of the last run of each recipe |

The seeder lives in the repo at `tests/e2e/scripts/seed-award-demo.ts`
because it imports `@op/common/testing/data`, which resolves only
inside a workspace package. It is the same data shape the e2e spec
`decision-manual-selection.spec.ts` uses.

## Troubleshooting

- **Nothing prints for a minute after the builder finishes**: that is
    the `selection` step's batch running. Wait for the `✓`/`✗` lines.

- **`open http://localhost:3100/en/` times out**: the dev server is
    compiling. Run the recipe again, or raise
    `AGENT_BROWSER_DEFAULT_TIMEOUT`.

- **`find testid create-decision-process` finds nothing**: the Create
    menu had not opened yet; the script waits 1.5 s after the click,
    raise it in `demo-builder.sh` on a slow machine.

- **`just status` shows rows after a run**: run `just cleanup
    <label>`, or `just cleanup` with no label to remove every demo
    row.

- **The API answers 500 for every request**: the local Redis
    (`localhost:6379`) is down or the API process holds a stale module
    graph; restart `pnpm w:api dev`.

- **A screenshot shows no footer bar**: the footer slides in; the
    scripts wait 1.5 s before the footer screenshots. Increase that
    wait if it still misses.

## Cleanup

Every row a run creates is removable by its label: `just cleanup
<label>`. The database is the shared local dev database, so clean up
after each run.
