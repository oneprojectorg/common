import { GLOBAL_USER_PUBLIC } from '@op/core';
import { sql } from 'drizzle-orm';

import { db } from '.';

/**
 * Seeds the sentinel "global" user identity the access-control substitution
 * layer resolves role grants against (GLOBAL_USER_PUBLIC for no-JWT callers).
 * It must exist in every environment or sentinel lookups fail closed. Anonymous
 * (anon-JWT) callers are not substituted — they have their own real identity —
 * so there is no anonymous sentinel.
 *
 * It is identity-only — an `auth.users` row + `public.users` mirror, no
 * profile/owner/Admin scaffolding — so it can never sign in or surface in
 * search, invites, or people lists. We direct-INSERT (the Admin API can't pin
 * a UUID) and suppress `on_auth_signup_create_user` via SET LOCAL
 * session_replication_role rather than DISABLE TRIGGER, since `auth.users` is
 * owned by `supabase_auth_admin`. Idempotent: safe to re-run.
 */
export async function seedGlobalUsers(): Promise<void> {
  // TODO: protect this row from deletion.
  const sentinels = [{ id: GLOBAL_USER_PUBLIC, name: 'Public' }];

  await db.transaction(async (tx) => {
    // Suppress all triggers (notably on_auth_signup_create_user) for the inserts
    // below. SET LOCAL resets automatically when the transaction commits.
    await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);

    for (const sentinel of sentinels) {
      await tx.execute(sql`
        INSERT INTO auth.users (id, email, created_at, updated_at)
        VALUES (${sentinel.id}, NULL, now(), now())
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

  console.log(`Seeded ${sentinels.length} global sentinel user(s)`);
}
