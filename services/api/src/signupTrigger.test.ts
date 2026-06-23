import { db, eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
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
