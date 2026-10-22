import { updateUserLocale } from '@op/common';
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

const getStoredLocale = async (authUserId: string) =>
  (
    await db.query.users.findFirst({
      columns: { locale: true },
      where: { authUserId },
    })
  )?.locale;

describe.concurrent('account.login: auth email locale', () => {
  it('replaces the stored locale with the one an existing account signs in from', async ({
    onTestFinished,
  }) => {
    const { email, user } = await signUpConfirmedUser(
      `locale-${randomUUID()}@oneproject.org`,
      onTestFinished,
    );
    await updateUserLocale({ authUserId: user.id, locale: 'es' });

    const caller = await createAnonymousCaller();
    await caller.account.login({ email, locale: 'fr' });

    expect(await getStoredLocale(user.id)).toBe('fr');
  });

  it('keeps the stored locale when a sign-in sends none', async ({
    onTestFinished,
  }) => {
    const { email, user } = await signUpConfirmedUser(
      `locale-kept-${randomUUID()}@oneproject.org`,
      onTestFinished,
    );
    await updateUserLocale({ authUserId: user.id, locale: 'es' });

    const caller = await createAnonymousCaller();
    await caller.account.login({ email });

    expect(await getStoredLocale(user.id)).toBe('es');
  });

  it('rejects a locale the app does not support', async () => {
    const caller = await createAnonymousCaller();

    await expect(
      caller.account.login({
        email: `locale-bad-${randomUUID()}@oneproject.org`,
        // @ts-expect-error -- the input only admits supported locales.
        locale: 'xx',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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
    onTestFinished(async () => {
      const userRow = await db.query.users.findFirst({
        columns: { profileId: true },
        where: { authUserId: created.id },
      });
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
