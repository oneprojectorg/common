import { db } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { inArray } from 'drizzle-orm';

import { appRouter } from '../../routers';
import { createCallerFactory } from '../../trpcFactory';
import {
  createIsolatedSession,
  createIsolatedTestClient,
  createTestContextWithSession,
  supabaseTestAdminClient,
} from '../supabase-utils';

const createCaller = createCallerFactory(appRouter);

export type GatingCaller = ReturnType<typeof createCaller>;

export type GatingCallers = {
  /** No session / no JWT — the request has no Supabase auth at all. */
  noJwt: () => Promise<GatingCaller>;
  /** Supabase anonymous JWT — `signInAnonymously()`. Cleanup is automatic. */
  anonJwt: () => Promise<GatingCaller>;
  /** Real authed user that passes the network allow-list. */
  commonJwt: (email: string) => Promise<GatingCaller>;
};

/**
 * Builds the three gating callers, registering automatic cleanup of any
 * anonymous Supabase users created via `anonJwt()`. The auth trigger
 * provisions `users` + `profiles` + `profile_users` rows for anon sign-ins;
 * cleanup deletes the profile (cascades to profile_users), then the
 * `users` row, then the auth user — same order as
 * `TestDecisionsDataManager.cleanup`.
 *
 * The caller passes `onTestFinished` so the cleanup is scoped to one test;
 * common-JWT users are not tracked here (they are owned by the test's own
 * `TestDecisionsDataManager` setup).
 */
export const createGatingCallers = (
  onTestFinished: (fn: () => void | Promise<void>) => void,
): GatingCallers => {
  const anonAuthUserIds: string[] = [];
  const anonProfileIds: string[] = [];

  onTestFinished(async () => {
    if (anonProfileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, anonProfileIds));
    }
    if (anonAuthUserIds.length > 0) {
      await db.delete(users).where(inArray(users.authUserId, anonAuthUserIds));
      const results = await Promise.allSettled(
        anonAuthUserIds.map((id) =>
          supabaseTestAdminClient.auth.admin.deleteUser(id),
        ),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `Failed to delete ${failures.length}/${anonAuthUserIds.length} anon auth users`,
        );
      }
    }
  });

  return {
    noJwt: async () => createCaller(await createTestContextWithSession(null)),

    anonJwt: async () => {
      const client = createIsolatedTestClient();
      const { data, error } = await client.auth.signInAnonymously();
      if (error || !data.session || !data.user) {
        throw new Error(
          `Failed to sign in anonymously: ${error?.message ?? 'no session'}`,
        );
      }

      anonAuthUserIds.push(data.user.id);

      // The auth trigger provisions public.users + profile + profile_users
      // rows for anon sign-ins. Capture the profileId for cleanup; if it's
      // missing we warn but don't fail — the auth user delete still runs.
      const userRecord = await db.query.users.findFirst({
        where: { authUserId: data.user.id },
      });
      if (userRecord?.profileId) {
        anonProfileIds.push(userRecord.profileId);
      } else {
        console.warn(
          `Anonymous user ${data.user.id} missing profile after sign-in trigger`,
        );
      }

      return createCaller(await createTestContextWithSession(data.session));
    },

    commonJwt: async (email: string) => {
      const { session } = await createIsolatedSession(email);
      return createCaller(await createTestContextWithSession(session));
    },
  };
};

export type GatingTestCtx = {
  task: { id: string };
  onTestFinished: (fn: () => void | Promise<void>) => void;
  callers: GatingCallers;
};
