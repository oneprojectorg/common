import { db } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { appRouter } from '../../../routers';
import { createCallerFactory } from '../../../trpcFactory';
import {
  createIsolatedSession,
  createIsolatedTestClient,
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../supabase-utils';

const createCaller = createCallerFactory(appRouter);

export type GatingCaller = ReturnType<typeof createCaller>;

export type GatingCallers = {
  /** Unauthenticated request — no session cookie. */
  noJwt: () => Promise<GatingCaller>;
  /** Supabase anonymous sign-in. */
  anonJwt: () => Promise<GatingCaller>;
  /** Authenticate as an existing `@oneproject.org` user by email. */
  existingJwt: (email: string) => Promise<GatingCaller>;
  /**
   * Create a throwaway `@oneproject.org` user and authenticate as them.
   * Useful for the generic gating matrix where the common-JWT cell only needs
   * a normal authenticated caller, not any particular org/profile context.
   * The created auth user and profile are cleaned up after the test.
   */
  freshJwt: () => Promise<GatingCaller>;
};

export const createGatingCallers = (
  onTestFinished: (fn: () => void | Promise<void>) => void,
): GatingCallers => {
  const createdAuthUserIds: string[] = [];
  const createdProfileIds: string[] = [];

  onTestFinished(async () => {
    if (createdProfileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
    }
    if (createdAuthUserIds.length > 0) {
      await db
        .delete(users)
        .where(inArray(users.authUserId, createdAuthUserIds));
      const results = await Promise.allSettled(
        createdAuthUserIds.map((id) =>
          supabaseTestAdminClient.auth.admin.deleteUser(id),
        ),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `Failed to delete ${failures.length}/${createdAuthUserIds.length} gating auth users`,
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

      createdAuthUserIds.push(data.user.id);

      const userRecord = await db.query.users.findFirst({
        where: { authUserId: data.user.id },
      });
      if (userRecord?.profileId) {
        createdProfileIds.push(userRecord.profileId);
      } else {
        console.warn(
          `Anonymous user ${data.user.id} missing profile after sign-in trigger`,
        );
      }

      return createCaller(await createTestContextWithSession(data.session));
    },

    existingJwt: async (email: string) => {
      const { session } = await createIsolatedSession(email);
      return createCaller(await createTestContextWithSession(session));
    },

    freshJwt: async () => {
      const email = `gating-${randomUUID().slice(0, 12)}@oneproject.org`;
      const { user } = await createTestUser(email);
      if (!user) {
        throw new Error(`Failed to create gating user: ${email}`);
      }

      createdAuthUserIds.push(user.id);

      const userRecord = await db.query.users.findFirst({
        where: { authUserId: user.id },
      });
      if (userRecord?.profileId) {
        createdProfileIds.push(userRecord.profileId);
      }

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
