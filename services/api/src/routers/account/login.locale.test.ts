import { signUpConfirmedUser } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  createTestContextWithSession,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const createAnonymousCaller = async () =>
  createCaller(await createTestContextWithSession(null));

describe.concurrent('account.login: auth email locale', () => {
  it('stores the locale an existing account signs in from', async ({
    onTestFinished,
  }) => {
    const { email, user } = await signUpConfirmedUser(
      `locale-${randomUUID()}@oneproject.org`,
      onTestFinished,
    );

    const caller = await createAnonymousCaller();
    await expect(caller.account.login({ email, locale: 'es' })).resolves.toBe(
      true,
    );

    const row = await db.query.users.findFirst({
      columns: { locale: true },
      where: { authUserId: user.id },
    });
    expect(row?.locale).toBe('es');
  });

  it('records the locale in user_metadata of an account the sign-in creates', async ({
    onTestFinished,
  }) => {
    const email = `locale-new-${randomUUID()}@oneproject.org`;

    const caller = await createAnonymousCaller();
    await expect(caller.account.login({ email, locale: 'fr' })).resolves.toBe(
      true,
    );

    const created = await db.query.authUsers.findFirst({
      columns: { id: true },
      where: { email },
    });
    if (!created) {
      throw new Error(`Sign-in did not create an account for ${email}`);
    }
    const userRow = await db.query.users.findFirst({
      columns: { profileId: true },
      where: { authUserId: created.id },
    });
    onTestFinished(async () => {
      if (userRow?.profileId) {
        await db.delete(profiles).where(eq(profiles.id, userRow.profileId));
      }
      await supabaseTestAdminClient.auth.admin.deleteUser(created.id);
    });

    const { data } = await supabaseTestAdminClient.auth.admin.getUserById(
      created.id,
    );
    expect(data.user?.user_metadata.locale).toBe('fr');
  });
});
