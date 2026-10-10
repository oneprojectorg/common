import { db, eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  TEST_USER_DEFAULT_PASSWORD,
  createIsolatedTestClient,
  supabaseTestAdminClient,
} from './test/supabase-utils';

/**
 * Integration coverage for the `create_user_on_signup` trigger's anonymous
 * display-name behaviour. These run against the live test database, so the
 * trigger (and its `anonymous_user_seq` sequence) executes for real.
 */
describe.concurrent('create_user_on_signup: anonymous display names', () => {
  /**
   * Signs in a fresh anonymous user, registers it for cleanup, and returns the
   * display name the trigger assigned to its individual profile.
   */
  const signInAnonAndReadName = async (
    trackAuthUserId: (id: string) => void,
    trackProfileId: (id: string) => void,
  ): Promise<string> => {
    const client = createIsolatedTestClient();
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error(
        `Failed to sign in anonymously: ${error?.message ?? 'no user'}`,
      );
    }
    trackAuthUserId(data.user.id);

    const [row] = await db
      .select({ profileId: profiles.id, name: profiles.name })
      .from(users)
      .innerJoin(profiles, eq(profiles.id, users.profileId))
      .where(eq(users.authUserId, data.user.id));

    if (!row) {
      throw new Error(`No individual profile for anon user ${data.user.id}`);
    }
    trackProfileId(row.profileId);

    return row.name;
  };

  it('names anonymous users "Participant <n>" and never collides between them', async ({
    onTestFinished,
  }) => {
    const authUserIds: string[] = [];
    const profileIds: string[] = [];

    onTestFinished(async () => {
      if (profileIds.length > 0) {
        await db.delete(profiles).where(inArray(profiles.id, profileIds));
      }
      if (authUserIds.length > 0) {
        await db.delete(users).where(inArray(users.authUserId, authUserIds));
        await Promise.allSettled(
          authUserIds.map((id) =>
            supabaseTestAdminClient.auth.admin.deleteUser(id),
          ),
        );
      }
    });

    const track = (arr: string[]) => (id: string) => {
      arr.push(id);
    };

    const firstName = await signInAnonAndReadName(
      track(authUserIds),
      track(profileIds),
    );
    const secondName = await signInAnonAndReadName(
      track(authUserIds),
      track(profileIds),
    );

    // Each anonymous user gets a sequential "Participant <n>" handle...
    expect(firstName).toMatch(/^Participant \d+$/);
    expect(secondName).toMatch(/^Participant \d+$/);
    // ...and the number guarantees uniqueness across signups. We assert
    // distinctness rather than exact values: the sequence is global and may
    // skip values, so the only contract is "unique", not "1 then 2".
    expect(firstName).not.toEqual(secondName);
  });
});

/**
 * Integration coverage for the `sync_user_email` trigger, which mirrors an
 * auth.users email change into public.users. The trigger previously joined on
 * `public.users.id = new.id`, but public.users.id is an independent UUID, so it
 * matched zero rows and never synced. The join must be on `auth_user_id`.
 */
describe.concurrent('sync_user_email: mirrors auth email changes', () => {
  /** Signs up an email user and returns its auth id, mirrored profile, and email. */
  const signUpEmailUser = async (
    email: string,
  ): Promise<{
    authUserId: string;
    profileId: string | null;
    publicEmail: string | null;
  }> => {
    const client = createIsolatedTestClient();
    const { data, error } = await client.auth.signUp({
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    if (error || !data.user) {
      throw new Error(`Failed to sign up: ${error?.message ?? 'no user'}`);
    }

    const [row] = await db
      .select({ profileId: users.profileId, email: users.email })
      .from(users)
      .where(eq(users.authUserId, data.user.id));

    return {
      authUserId: data.user.id,
      profileId: row?.profileId ?? null,
      publicEmail: row?.email ?? null,
    };
  };

  const readPublicEmail = async (
    authUserId: string,
  ): Promise<string | null> => {
    const [row] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.authUserId, authUserId));

    return row?.email ?? null;
  };

  const cleanUp = async (authUserId: string, profileId: string | null) => {
    if (profileId) {
      await db.delete(profiles).where(eq(profiles.id, profileId));
    }
    await db.delete(users).where(eq(users.authUserId, authUserId));
    await supabaseTestAdminClient.auth.admin.deleteUser(authUserId);
  };

  it('updates public.users.email when auth.users.email changes', async ({
    onTestFinished,
  }) => {
    const originalEmail = `sync-${crypto.randomUUID()}@example.com`;
    const user = await signUpEmailUser(originalEmail);
    onTestFinished(() => cleanUp(user.authUserId, user.profileId));

    // The signup trigger mirrors the original email into public.users.
    expect(user.publicEmail).toBe(originalEmail);

    const newEmail = `synced-${crypto.randomUUID()}@example.com`;
    const { error } = await supabaseTestAdminClient.auth.admin.updateUserById(
      user.authUserId,
      { email: newEmail },
    );
    expect(error).toBeNull();

    expect(await readPublicEmail(user.authUserId)).toBe(newEmail);
  });
});
