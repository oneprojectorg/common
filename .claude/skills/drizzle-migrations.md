---
name: drizzle-migrations
description: Drizzle ORM workflow for schema edits and migrations. Use whenever touching services/db or anything that changes table shape.
---

## Where things live

- Schema: `services/db/schema/` — one file per logical area, re-exported from `index.ts`.
- Drizzle config: `services/db/drizzle.config.ts` (entry: `schema/publicTables.ts`, snake_case casing, `drizzle.migrations` tracking table).
- Generated migrations: `services/db/migrations/<timestamp>_<slug>/{migration.sql,snapshot.json}` — one directory per migration. Drizzle records applied migrations in the `drizzle.migrations` table on the DB; there's no on-disk journal.
- Drizzle client: imported via `@op/db`.

## Workflow

1. Edit a schema file under `services/db/schema/`.
2. Run `pnpm w:db generate` to produce a new migration directory (`migration.sql` + `snapshot.json`). This creates the migration; it does **not** apply it.
3. **Read the generated SQL.** Drizzle occasionally produces destructive ops (DROP, RENAME, NOT NULL backfills with no default) that need manual care.
4. Iterate on the schema until the generated SQL looks right. If a generation is wrong, delete the new migration directory, fix the schema, and re-run `generate` until it's clean.
5. **Don't run `pnpm w:db migrate` locally.** It's denied in `.claude/settings.json`. CI/CD applies migrations against every environment (including local dev via the docker stack's startup), so you don't need to apply by hand. If you need the schema in your local DB to test, restart the docker stack — migrations run on boot.

## Don't

- Don't run `pnpm w:db migrate`. The agent should never apply migrations directly — it's a denied command, and applying outside the normal flow risks drift between the migration files and the DB state.
- Don't hand-edit `migration.sql` or `snapshot.json` after a migration has been committed and shipped — write a new corrective migration instead.
- Don't delete a migration directory that's already been merged to `dev`/`main`. Other devs and shared envs have applied it; removing it desyncs everyone.

## Type generation

Schema types flow through `@op/db` automatically — re-running `generate` and a typecheck (`pnpm w:app typecheck`) is enough to surface mismatches.
