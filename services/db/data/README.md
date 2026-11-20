# Data scripts

This directory holds data-only SQL: backfills, checks and clean-ups that change or read rows, not the schema. Schema changes stay in `../migrations`.

Run each file by hand with `psql` against each environment. Never run them through `migrate`, and never move them into `migrations/`:

```sh
psql "$DATABASE_URL" -f services/db/data/<file>.sql
```

| File | What it does |
|---|---|
| `backfill-phase-rows.sql` | Adds phase rows and profiles for decisions that have phases only in `instance_data.phases`, and links transitions to them. Skips decisions that already have rows. Commits each decision on its own. Safe to re-run. |
| `check-missing-phase-rows.sql` | Read-only. Lists decisions that have phases in `instance_data.phases` and no phase rows. Zero rows means every decision has rows. |
| `strip-blob-phases.sql` | Removes `instance_data.phases` from decisions that have phase rows. Run it only with #2431, after the fallback read is gone. |

## Settings

The scripts read these settings. Set them with a session `SET`, not `SET LOCAL`. A blank value means "not set".

| Setting | Read by | Effect |
|---|---|---|
| `op_backfill.instance_ids` | all three | Required. `'<uuid>,<uuid>'` limits the run to those decisions; `'all'` runs on every decision. Unset or blank stops the script before it reads or writes anything. A run on one decision is the dry run. |

The backfill commits inside its `DO` block, so it must not run in a transaction. Put the `SET` in its own `-c`, and do not use `psql -1`:

```sh
psql "$DATABASE_URL" -c "SET op_backfill.instance_ids = '<uuid>,<uuid>'" \
  -f services/db/data/backfill-phase-rows.sql

psql "$DATABASE_URL" -c "SET op_backfill.instance_ids = 'all'" \
  -f services/db/data/backfill-phase-rows.sql
```

## Phase rows: order of runs

Run the backfill once per environment, only when both #2429 (the app reads phase rows) and #2430 (the app writes phase rows) are live there. Before #2430, the app still writes `instance_data.phases` only, so an edit to a backfilled decision never reaches its rows. In production, both ship in the first release cut after both merge.

1. **#2429 and #2430 are live.** Run the backfill on one decision first and check it in the app. Then run it with `op_backfill.instance_ids = 'all'`. It skips, with a NOTICE, decisions whose phases fail validation. Fix those by hand and run it again.

2. **Before #2431 ships.** Run `check-missing-phase-rows.sql` with `op_backfill.instance_ids = 'all'`. It must return zero rows. After #2431 removes the fallback read, a decision with no rows cannot advance, revert or publish.

3. **With #2431.** Run `strip-blob-phases.sql` with `op_backfill.instance_ids = 'all'`. It keeps the blob on decisions with no rows.

`packages/common/src/services/decision/backfillPhaseRows.test.ts` runs these files against the test database.
