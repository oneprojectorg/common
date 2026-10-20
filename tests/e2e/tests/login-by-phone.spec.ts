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

  test('given the texted code was not accepted, when the person picks email instead, then the email field is offered empty', async ({
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

    await page
      .getByRole('textbox', { name: 'Enter verification code' })
      .fill('000000');
    const codeAlert = page.getByRole('alert').filter({ hasText: 'code' });
    await expect(codeAlert).toBeVisible({ timeout: 20000 });

    await expect(
      page.getByRole('button', { name: 'Use a different phone number' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Use email instead' }).click();

    await expect(page.getByRole('tab', { name: 'Email' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Email me a code' }),
    ).toBeVisible();
    await expect(codeAlert).not.toBeVisible();
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
      page.getByRole('button', { name: 'Use a different email address' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Use phone instead' }).click();

    await expect(
      page.getByRole('tab', { name: 'Phone Number' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('textbox', { name: 'Phone Number' }),
    ).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Text me a code' }),
    ).toBeVisible();
  });
});
