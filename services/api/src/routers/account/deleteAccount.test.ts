import { db } from '@op/db/client';
import { users } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import accountRouter from '.';

describe.concurrent('account.deleteAccount', () => {
  const createCaller = createCallerFactory(accountRouter);

  it('reject unauthenticated callers', async () => {
    const caller = createCaller(await createTestContextWithSession(null));

    await expect(caller.deleteAccount()).rejects.toMatchObject({
      cause: {
        name: 'UnauthorizedError',
      },
    });
  });

  it('deletes the current user, their individual profile, and the auth user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Delete Account Test Org',
    });

    // Hydrate the user's individual profile by calling getMyAccount once.
    // The public.users row + individual profile are created lazily on first
    // authenticated request.
    const setupSession = await createIsolatedSession(adminUser.email);
    const setupCaller = createCaller(
      await createTestContextWithSession(setupSession.session),
    );
    await setupCaller.getMyAccount();

    const [beforeUser] = await db
      .select({ id: users.id, profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, adminUser.authUserId));
    expect(beforeUser).toBeDefined();
    const individualProfileId = beforeUser?.profileId;
    expect(individualProfileId).toBeTruthy();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.deleteAccount();
    expect(result.deletedId).toBe(adminUser.authUserId);

    // Individual profile is gone
    if (individualProfileId) {
      const remainingProfile = await db.query.profiles.findFirst({
        where: { id: individualProfileId },
      });
      expect(remainingProfile).toBeUndefined();
    }

    // public.users row is gone (cascade from auth user delete)
    const [remainingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, adminUser.authUserId));
    expect(remainingUser).toBeUndefined();

    // Auth user is gone
    if (supabaseTestAdminClient) {
      const { data, error } =
        await supabaseTestAdminClient.auth.admin.getUserById(
          adminUser.authUserId,
        );
      expect(error ?? !data.user).toBeTruthy();
    }
  });
});
