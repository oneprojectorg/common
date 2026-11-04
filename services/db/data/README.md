# Data scripts

This directory holds data-only SQL: backfills, checks and clean-ups that change or read rows, not the schema. Schema changes stay in `../migrations`.

Run each file by hand with `psql` against each environment. Never run them through `migrate`, and never move them into `migrations/`:

```sh
psql "$DATABASE_URL" -f services/db/data/<file>.sql
```

| File | What it does |
|---|---|
| `backfill-phase-rows.sql` | Adds phase rows and profiles for decisions that have phases only in `instance_data.phases`, and links transitions to them. Commits each decision on its own. Safe to re-run. |
| `check-phase-drift.sql` | Read-only. Lists decisions whose phase rows and `instance_data.phases` disagree. Zero rows means they agree. |
| `strip-blob-phases.sql` | Removes `instance_data.phases` from decisions that have phase rows. Release 4 only, after the fallback read is gone. |

## Settings

The scripts read these settings. Set them with a session `SET`, not `SET LOCAL`. A blank value means "not set".

| Setting | Read by | Effect |
|---|---|---|
| `op_backfill.instance_ids` | all three | `'<uuid>,<uuid>'` limits the run to those decisions. |
| `op_backfill.fill_partial` | backfill | `'true'` also adds the missing rows to decisions whose rows cover only some phases. Needs `instance_ids`. |
| `op_backfill.drift_kind` | drift check | `'no_rows'`, `'partial'` or `'drift'` shows only that kind. |

The backfill commits inside its `DO` block, so it must not run in a transaction. Put the `SET` in its own `-c`, and do not use `psql -1`:

```sh
psql "$DATABASE_URL" -c "SET op_backfill.instance_ids = '<uuid>,<uuid>'" \
  -f services/db/data/backfill-phase-rows.sql
```

## Phase rows: order of runs

1. **Release 2.** Run the backfill on every environment, development too, for frozen decisions only. A frozen decision is completed or cancelled, so nobody edits it. Scope each run with `op_backfill.instance_ids`. To list the ids:

   ```sql
   SELECT string_agg(id::text, ',') FROM decision_process_instances
   WHERE status IN ('completed', 'cancelled');
   ```

   Until release 3, the app still writes `instance_data.phases` and the backfill skips decisions that have rows. If you backfill a decision that someone then edits in the builder, it shows stale rows while the read flag is on, and the edit is lost when release 3 ships.

2. **After release 3 is live.** Run the backfill without a scope.

3. **Before release 4.** Run the drift check with `op_backfill.drift_kind = 'no_rows'`. It must return zero rows. This is the only gate: after the fallback read is gone, a decision with no rows cannot advance, revert or publish. After release 3, `partial` and `drift` rows are expected. The blob is frozen, so a decision with a phase added or removed shows `partial` or `drift`, and each decision made after release 3 shows `drift`.

4. **Release 4.** Run `strip-blob-phases.sql`. It keeps the blob on decisions with no rows.

`packages/common/src/services/decision/backfillPhaseRows.test.ts` runs these files against the test database.
