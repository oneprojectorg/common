# Data scripts

This directory holds data-only SQL: backfills, checks and clean-ups that change or read rows, not the schema. Schema changes stay in `../migrations`.

Run each file by hand with `psql` against each environment. Never run them through `migrate`, and never move them into `migrations/`:

```sh
psql "$DATABASE_URL" -f services/db/data/<file>.sql
```

| File | What it does |
|---|---|
| `backfill-phase-rows.sql` | Adds phase rows and profiles for decisions that have phases only in `instance_data.phases`, and links transitions to them. Safe to re-run. |
| `check-phase-drift.sql` | Read-only. Lists decisions whose phase rows and `instance_data.phases` disagree. Zero rows means they agree. |
| `strip-blob-phases.sql` | Removes `instance_data.phases`. Release 4 only, after the fallback read is gone. |

`backfill-phase-rows.sql` and `check-phase-drift.sql` read `op_backfill.instance_ids`. Set it in the same session to limit a run to some decisions:

```sql
SET op_backfill.instance_ids = '<uuid>,<uuid>';
```

`packages/common/src/services/decision/backfillPhaseRows.test.ts` runs these files against the test database.
