import { parsePhoneNumber } from '@op/common';
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
  /**
   * Tier 2 — an authenticated account that is *not* in the network: a non-org
   * (`@example.com`) user with no allow-list entry (e.g. an anonymous user who
   * upgraded to a real account). Today's network gate rejects this with
   * `AccessTierError` (callerTier `user`); only a procedure that admits tier-2
   * access lets it through.
   *
   * With `email`, signs in that existing user; without, creates a throwaway one
   * (auth user + profile are cleaned up after the test).
   */
  userJwt: (email?: string) => Promise<GatingCaller>;
  /**
   * Tier 3 — a user who is in the network: an `@oneproject.org` member (or a
   * non-org user on the allow list). With `email`, signs in that existing user;
   * without, creates a throwaway one (cleaned up after the test).
   */
  networkJwt: (email?: string) => Promise<GatingCaller>;
  /**
   * A phone-only account, which holds no email at all.
   *
   * Neither the domain rule nor the allow list can speak for such an account,
   * so the network gate refuses it. Use this caller in a test that has to
   * reach the gate with a credential that authenticates but does not admit.
   *
   * Not part of {@link GatingCells}: adding a fifth required cell would touch
   * every gating suite in the repository.
   */
  phoneJwt: () => Promise<GatingCaller>;
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

  // Sign in as an already-seeded user.
  const existingCaller = async (email: string) => {
    const { session } = await createIsolatedSession(email);
    return createCaller(await createTestContextWithSession(session));
  };

  // Create a throwaway, confirmed user on the given domain and sign in as them.
  // `@oneproject.org` is in-network (tier 3); any other domain is a plain
  // tier-2 user with no allow-list entry.
  const freshCaller = async (domain: string) => {
    const email = `gating-${randomUUID().slice(0, 12)}@${domain}`;
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

    return existingCaller(email);
  };

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

    userJwt: async (email?: string) =>
      email ? existingCaller(email) : freshCaller('example.com'),

    networkJwt: async (email?: string) =>
      email ? existingCaller(email) : freshCaller('oneproject.org'),

    phoneJwt: async () => {
      const { session, authUserId } = await createPhoneAccount();
      createdAuthUserIds.push(authUserId);

      const userRecord = await db.query.users.findFirst({
        where: { authUserId },
      });
      if (userRecord?.profileId) {
        createdProfileIds.push(userRecord.profileId);
      }

      return createCaller(await createTestContextWithSession(session));
    },
  };
};

/**
 * Builds a real phone-only account and signs in as it.
 *
 * The account holds a confirmed number and no email, which is the shape GoTrue
 * gives someone who signs in by phone. The network gate has to refuse it.
 *
 * A password exists only so the fixture can sign in. Nothing in the product
 * sets one: a person signs in with a texted code, and GoTrue issues the
 * session.
 */
const createPhoneAccount = async () => {
  // Draws from +1 500 555 1000-9999. The 500 area code is not geographic and
  // Twilio reserves 500 555 for testing, so no fixture names a real line. The
  // pool was 90 wide, which two concurrent files could exhaust into a
  // duplicate that `auth.admin.createUser` rejects.
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  const phone = parsePhoneNumber(`+1500555${suffix}`);
  const password = randomUUID();

  const { data, error } = await supabaseTestAdminClient.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `Failed to create a phone account: ${error?.message ?? 'no user'}`,
    );
  }

  const client = createIsolatedTestClient();
  const signIn = await client.auth.signInWithPassword({ phone, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(
      `Failed to sign in by phone: ${signIn.error?.message ?? 'no session'}`,
    );
  }

  return { session: signIn.data.session, authUserId: data.user.id };
};

export type GatingTestCtx = {
  task: { id: string };
  onTestFinished: (fn: () => void | Promise<void>) => void;
  callers: GatingCallers;
};
