import { users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

const openNotificationSettings = async (page: Page) => {
  await page.goto('/en/', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByTestId('user-menu-trigger');
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  const settingsItem = page.getByRole('menuitem', {
    name: 'Settings',
    exact: true,
  });
  await expect(async () => {
    await trigger.click();
    await expect(settingsItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await settingsItem.click();

  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(
    dialog.getByRole('heading', { name: 'Email notifications' }),
  ).toBeVisible({ timeout: 15_000 });
  return dialog;
};

const readStoredPreferences = async (authUserId: string) => {
  const [row] = await db
    .select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  return row?.notificationPreferences;
};

test.describe('Settings — notification preferences', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  const signInFreshMember = async (page: Page) => {
    const org = await createOrganization({
      testId: `settings-notif-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    return org.adminUser;
  };

  test('a member who never saved a preference sees every switch on', async ({
    page,
  }) => {
    await signInFreshMember(page);
    const dialog = await openNotificationSettings(page);

    for (const name of [
      'Your proposals and comments',
      'Things you follow',
      'Process updates',
      'Relationship requests',
    ]) {
      const group = dialog.getByRole('group', { name });
      await expect(group.getByRole('switch', { name: 'Email' })).toBeChecked();
      await expect(group.getByRole('switch', { name: 'SMS' })).toBeChecked();
    }
  });

  test('turning one switch off saves it, survives a reload, and stores only that channel', async ({
    page,
  }) => {
    const member = await signInFreshMember(page);
    const dialog = await openNotificationSettings(page);

    const smsSwitch = dialog
      .getByRole('group', { name: 'Process updates' })
      .getByRole('switch', { name: 'SMS' });
    await smsSwitch.click();

    await expect(smsSwitch).not.toBeChecked();
    await expect(dialog.getByText('Saved', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() => readStoredPreferences(member.authUserId), {
        timeout: 15_000,
      })
      .toEqual({ processUpdates: { sms: false } });

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reopened = await openNotificationSettings(page);
    const processUpdates = reopened.getByRole('group', {
      name: 'Process updates',
    });
    await expect(
      processUpdates.getByRole('switch', { name: 'SMS' }),
    ).not.toBeChecked();
    await expect(
      processUpdates.getByRole('switch', { name: 'Email' }),
    ).toBeChecked();
    await expect(
      reopened
        .getByRole('group', { name: 'Things you follow' })
        .getByRole('switch', { name: 'SMS' }),
    ).toBeChecked();
  });

  test('a switch turned off and back on reads as on after a reload', async ({
    page,
  }) => {
    const member = await signInFreshMember(page);
    const dialog = await openNotificationSettings(page);

    const emailSwitch = dialog
      .getByRole('group', { name: 'Things you follow' })
      .getByRole('switch', { name: 'Email' });
    await emailSwitch.click();
    await expect(emailSwitch).not.toBeChecked();
    await expect
      .poll(() => readStoredPreferences(member.authUserId), {
        timeout: 15_000,
      })
      .toEqual({ thingsYouFollow: { email: false } });

    await emailSwitch.click();
    await expect(emailSwitch).toBeChecked();
    await expect
      .poll(() => readStoredPreferences(member.authUserId), {
        timeout: 15_000,
      })
      .toEqual({ thingsYouFollow: { email: true } });

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reopened = await openNotificationSettings(page);
    await expect(
      reopened
        .getByRole('group', { name: 'Things you follow' })
        .getByRole('switch', { name: 'Email' }),
    ).toBeChecked();
  });

  test('the switches are reachable and operable from the keyboard', async ({
    page,
  }) => {
    const member = await signInFreshMember(page);
    const dialog = await openNotificationSettings(page);

    const emailSwitch = dialog
      .getByRole('group', { name: 'Your proposals and comments' })
      .getByRole('switch', { name: 'Email' });
    await emailSwitch.focus();
    await expect(emailSwitch).toBeFocused();
    await page.keyboard.press('Space');

    await expect(emailSwitch).not.toBeChecked();
    await expect
      .poll(() => readStoredPreferences(member.authUserId), {
        timeout: 15_000,
      })
      .toEqual({ proposalsAndComments: { email: false } });
  });
});
