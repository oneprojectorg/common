import { GLOBAL_USER_ANONYMOUS, GLOBAL_USER_PUBLIC } from '@op/core';
import { sql } from 'drizzle-orm';

import type { db } from '.';

/**
 * Seeds the two sentinel "global" user identities the access-control
 * substitution layer resolves against:
 *
 *   - GLOBAL_USER_PUBLIC    stands in for no-JWT public callers
 *   - GLOBAL_USER_ANONYMOUS stands in for anon-JWT callers
 *
 * They must exist in every environment before the substitution layer ships,
 * otherwise sentinel role-grant lookups have nothing to resolve and fail
 * closed. They are seeded (not migrated) because this repo keeps migrations
 * DDL-only and seeds reference data through idempotent scripts.
 *
 * Each sentinel is identity-only: an `auth.users` row (hardcoded UUID, NULL
 * email) plus its `public.users` mirror. No individual profile, no
 * `profile_users` owner row, and no Admin grant — so they can never sign in
 * and never surface in profile/user search, invite flows, or people lists.
 *
 * We direct-INSERT into `auth.users` (the Supabase Admin API can't pin a UUID)
 * and suppress the `on_auth_signup_create_user` trigger so it doesn't build the
 * profile/owner/Admin scaffolding it creates for real signups. The trigger is
 * suppressed via `SET LOCAL session_replication_role = 'replica'` rather than
 * `ALTER TABLE ... DISABLE TRIGGER`, because `auth.users` is owned by
 * `supabase_auth_admin` (not even `postgres` can ALTER it). `session_replication_role`
 * needs no table ownership, is scoped to the transaction by SET LOCAL, and is
 * agnostic to which trigger version an environment has. It requires the seed to
 * connect as `postgres` (the direct DB role all seed scripts use), not the
 * PostgREST `service_role`.
 *
 * Idempotent: safe to re-run. `auth.users` uses ON CONFLICT (id) DO NOTHING and
 * the `public.users` mirror is guarded by WHERE NOT EXISTS (the table has no
 * unique constraint on auth_user_id to conflict on).
 */
export async function seedGlobalUsers(database: typeof db): Promise<void> {
  const sentinels = [
    { id: GLOBAL_USER_PUBLIC, name: 'Public', isAnonymous: false },
    { id: GLOBAL_USER_ANONYMOUS, name: 'Anonymous', isAnonymous: true },
  ];

  await database.transaction(async (tx) => {
    // Suppress all triggers (notably on_auth_signup_create_user) for the inserts
    // below. SET LOCAL resets automatically when the transaction commits.
    await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);

    for (const sentinel of sentinels) {
      await tx.execute(sql`
        INSERT INTO auth.users (id, email, is_anonymous, created_at, updated_at)
        VALUES (${sentinel.id}, NULL, ${sentinel.isAnonymous}, now(), now())
        ON CONFLICT (id) DO NOTHING
      `);

      await tx.execute(sql`
        INSERT INTO public.users (auth_user_id, name, email, created_at, updated_at)
        SELECT ${sentinel.id}, ${sentinel.name}, NULL, now(), now()
        WHERE NOT EXISTS (
          SELECT 1 FROM public.users WHERE auth_user_id = ${sentinel.id}
        )
      `);
    }
  });

  console.log(`Seeded ${sentinels.length} global sentinel users`);
}
