import { releaseTestPhoneNumber } from '@op/common/testing/data';
import { randomUUID } from 'node:crypto';

import {
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Login by phone', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('given a texted code was not accepted, when the person edits the code and changes the contact, then the error clears and each tab offers its field empty', async ({
    page,
  }) => {
    const phone = '+15005550009';
    await releaseTestPhoneNumber(phone);

    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.getByRole('tab', { name: 'Phone Number' }).click();
    await page.getByRole('textbox', { name: 'Phone Number' }).fill(phone);
    await page.getByRole('button', { name: 'Text me a code' }).click();

    await expect(
      page.getByRole('heading', { name: 'Check your texts' }),
    ).toBeVisible({ timeout: 20000 });

    const codeField = page.getByRole('textbox', {
      name: 'Enter verification code',
    });
    const codeGroup = page.getByRole('group').filter({ has: codeField });
    const codeAlert = codeGroup.getByRole('alert');

    await codeField.fill('000000');
    await expect(codeAlert).toContainText('code', { timeout: 20000 });
    await expect(codeField).toHaveAttribute('aria-invalid', 'true');

    await codeField.fill('1');
    await expect(codeField).not.toHaveAttribute('aria-invalid', 'true');
    await expect(codeAlert).toHaveCount(0);

    await expect(
      page.getByRole('button', { name: 'Use email instead' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Use a different phone number or email' })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Check your texts' }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Phone Number' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('textbox', { name: 'Phone Number' }),
    ).toHaveValue(phone);

    await page.getByRole('tab', { name: 'Email' }).click();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Email me a code' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Phone Number' }).click();
    await expect(
      page.getByRole('textbox', { name: 'Phone Number' }),
    ).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Text me a code' }),
    ).toBeVisible();
  });

  test('given the emailed code step, when the person picks phone instead, then the phone field is offered empty', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `phone-instead-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(org.adminUser.email);
    await page.getByRole('button', { name: 'Email me a code' }).click();

    await expect(
      page.getByRole('heading', { name: 'Check your email' }),
    ).toBeVisible({ timeout: 20000 });

    await expect(
      page.getByRole('button', { name: 'Use phone instead' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Use a different phone number or email' })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Check your email' }),
    ).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(
      org.adminUser.email,
    );

    await page.getByRole('tab', { name: 'Phone Number' }).click();
    await expect(
      page.getByRole('tab', { name: 'Phone Number' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('textbox', { name: 'Phone Number' }),
    ).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Text me a code' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Email' }).click();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Email me a code' }),
    ).toBeVisible();
  });
});
