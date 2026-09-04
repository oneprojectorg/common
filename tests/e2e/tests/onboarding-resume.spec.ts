import { users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createSupabaseAdminClient,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Resuming an unfinished onboarding.
 *
 * An account whose onboarding was abandoned mid-session (`onboardedAt` never
 * set) must be able to pick it back up on any later visit: the app routes it
 * back into onboarding — preserving where it was headed via `?redirect=` — and
 * never locks it out. This holds for members and non-members alike; once
 * onboarding is complete the account is no longer pulled back in.
 *
 * `member` = a network email domain; `non-member` = anything else.
 * `createUser` marks accounts onboarded, so "unfinished" nulls `onboardedAt`.
 */

const MEMBER_DOMAIN = 'oneproject.org';
const NON_MEMBER_DOMAIN = 'example.com';

test.describe('Onboarding resume', () => {
  // Authenticate manually per test → start each from a clean, logged-out state.
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();
  const createdAuthUserIds: string[] = [];

  const signInAs = async (
    page: Parameters<typeof authenticateAsUser>[0],
    { member, onboarded }: { member: boolean; onboarded: boolean },
  ) => {
    const email = `e2e-onboard-resume-${randomUUID().slice(0, 8)}@${member ? MEMBER_DOMAIN : NON_MEMBER_DOMAIN}`;
    const authUser = await createUser({ supabaseAdmin: admin, email });
    createdAuthUserIds.push(authUser.id);

    if (!onboarded) {
      await db
        .update(users)
        .set({ onboardedAt: null })
        .where(eq(users.authUserId, authUser.id));
    }

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    return email;
  };

  test.afterAll(async () => {
    await Promise.all(
      createdAuthUserIds.map((id) => admin.auth.admin.deleteUser(id)),
    );
  });

  test('non-member resumes onboarding when returning to a public page', async ({
    page,
  }) => {
    await signInAs(page, { member: false, onboarded: false });

    // A public (no-header) URL: the layout routes back into onboarding before it
    // ever loads a decision, so any slug exercises the return path.
    const target = '/en/decisions/any-decision-slug';
    const response = await page.goto(target, { waitUntil: 'domcontentloaded' });

    // Never a dead-end (this used to 403 at /start): lands on onboarding with the
    // original destination preserved.
    expect(response?.status()).not.toBe(403);
    await expect(page).toHaveURL(/\/en\/start\?redirect=/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(target);
    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).not.toBeVisible();
  });

  test('member resumes onboarding when returning to an app page', async ({
    page,
  }) => {
    await signInAs(page, { member: true, onboarded: false });

    // A member passes the walled-garden gate, then gets sent to onboarding with
    // the destination carried through so they return there afterwards.
    await page.goto('/en/decisions', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/en\/start\?redirect=/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(
      '/en/decisions',
    );
    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('a resumed non-member continues in the org-less flow', async ({
    page,
  }) => {
    const email = await signInAs(page, { member: false, onboarded: false });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Full Name').fill('Resume NonMember');
    await page.getByLabel('Headline').fill('Tester');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Non-members skip org search and go straight to ToS.
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'Find organizations you belong to' }),
    ).not.toBeVisible();
  });

  test('a resumed member continues in the full org flow', async ({ page }) => {
    const email = await signInAs(page, { member: true, onboarded: false });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Full Name').fill('Resume Member');
    await page.getByLabel('Headline').fill('Tester');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Members get the organization search step.
    await expect(
      page.getByRole('heading', { name: 'Find organizations you belong to' }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('a resumed member returns to where they were headed after finishing', async ({
    page,
  }) => {
    const email = await signInAs(page, { member: true, onboarded: false });

    // Arrive as if redirected from /en/decisions, then finish onboarding.
    await page.goto('/en/start?redirect=%2Fen%2Fdecisions', {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Full Name').fill('Resume Return');
    await page.getByLabel('Headline').fill('Tester');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(
      page.getByRole('heading', { name: 'Find organizations you belong to' }),
    ).toBeVisible({ timeout: 15000 });
    const removeButtons = page.getByRole('button', { name: 'Remove' });
    while ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
    }
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click({ force: true });
    await checkboxes.nth(1).click({ force: true });
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Lands back on the preserved destination, not the default /?new=1 home.
    await page.waitForURL(/\/en\/decisions/, { timeout: 30000 });
    expect(page.url()).not.toContain('new=1');
  });

  test('the preserved destination keeps its query string', async ({ page }) => {
    await signInAs(page, { member: true, onboarded: false });

    await page.goto('/en/search?q=climate', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/en\/start\?redirect=/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(
      '/en/search?q=climate',
    );
  });

  test('a completed member onboarding is not resumed', async ({ page }) => {
    await signInAs(page, { member: true, onboarded: true });

    const response = await page.goto('/en/decisions', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.status()).not.toBe(403);
    await expect(page).toHaveURL(/\/en\/decisions/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/en\/start/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('a completed non-member is not resumed, and the network boundary still holds', async ({
    page,
  }) => {
    await signInAs(page, { member: false, onboarded: true });

    // /start admits any real account — no 403 even once onboarding is done, so a
    // stray visit is never a dead-end.
    const startResponse = await page.goto('/en/start', {
      waitUntil: 'domcontentloaded',
    });
    expect(startResponse?.status()).not.toBe(403);
    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });

    // The walled garden still forbids non-members in the (main) route group.
    const appResponse = await page.goto('/en/decisions', {
      waitUntil: 'domcontentloaded',
    });
    expect(appResponse?.status()).toBe(403);
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
  });
});
