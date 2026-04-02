import {
  joinProfileRequests,
  organizationUsers,
  organizations,
  users,
} from '@op/db/schema';
import { and, db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Onboarding - Organization Search (no domain match)', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  test.beforeAll(() => {
    supabaseAdmin = createSupabaseAdminClient();
  });

  test('user sees search screen and can skip to app', async ({ page }) => {
    const email = `e2e-org-search-skip-${randomUUID().slice(0, 6)}@oneproject.org`;
    await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Should see the personal details form first
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    // Fill in required fields
    await page.getByLabel('Full Name').fill('Test User Skip');
    await page.getByLabel('Headline').fill('Test Engineer');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);

    // Submit personal details
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should see the organization search screen
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).toBeVisible({ timeout: 15000 });

    // Remove any pre-populated domain-matched orgs so "Skip for now" is visible
    const removeButtons = page.getByRole('button', { name: 'Remove' });
    while ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
    }

    // Click "Skip for now"
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Should see the ToS acceptance screen
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });

    // Accept ToS and Privacy Policy checkboxes
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click({ force: true });
    await checkboxes.nth(1).click({ force: true });

    // Click "Join Common"
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');
  });

  test('user can search, select multiple orgs, and submit join requests', async ({
    page,
  }) => {
    const testId = randomUUID().slice(0, 6);

    // Create 2 searchable organizations with a unique, searchable name prefix
    const searchPrefix = `E2ESearchOrg${testId}`;

    const [org1, org2] = await Promise.all([
      createOrganization({
        testId: `${testId}-org1`,
        supabaseAdmin,
        users: { admin: 1, member: 0 },
        organizationName: `${searchPrefix} Alpha`,
      }),
      createOrganization({
        testId: `${testId}-org2`,
        supabaseAdmin,
        users: { admin: 1, member: 0 },
        organizationName: `${searchPrefix} Beta`,
      }),
    ]);

    // Create a new user
    const email = `e2e-org-search-select-${testId}@oneproject.org`;
    const authUser = await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Fill personal details
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Full Name').fill('Test User Search');
    await page.getByLabel('Headline').fill('Test Engineer');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should see the organization search screen
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).toBeVisible({ timeout: 15000 });

    // Remove any pre-populated domain-matched orgs so we start fresh
    const removeButtons = page.getByRole('button', { name: 'Remove' });
    while ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
    }

    // Search for organizations using the unique prefix
    const searchInput = page.getByRole('textbox', {
      name: 'Search or add your organization...',
    });
    await searchInput.fill(searchPrefix);

    // Wait for debounce + search results
    const org1Button = page.getByRole('button', {
      name: new RegExp(searchPrefix + ' Alpha'),
    });
    await expect(org1Button).toBeVisible({ timeout: 30000 });

    // Select first org
    await org1Button.click();

    // Verify "Continue" button shows with count
    await expect(
      page.getByRole('button', { name: /Continue with.*organization/ }),
    ).toBeVisible();

    // "Skip for now" should be hidden when orgs are selected
    await expect(
      page.getByRole('button', { name: 'Skip for now' }),
    ).not.toBeVisible();

    // Search and select second org
    await searchInput.fill(searchPrefix);
    const org2Button = page.getByRole('button', {
      name: new RegExp(searchPrefix + ' Beta'),
    });
    await expect(org2Button).toBeVisible({ timeout: 30000 });
    await org2Button.click();

    // Verify count updates to 2
    await expect(
      page.getByRole('button', { name: /Continue with.*organization/ }),
    ).toBeVisible();

    // Click continue
    await page
      .getByRole('button', { name: /Continue with.*organization/ })
      .click();

    // Should see ToS screen
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });

    // Accept ToS and Privacy Policy
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click({ force: true });
    await checkboxes.nth(1).click({ force: true });

    // Click "Join Common"
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');

    // Verify join requests were created for both orgs
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    expect(userRecord?.profileId).toBeTruthy();

    const joinRequests = await db
      .select()
      .from(joinProfileRequests)
      .where(eq(joinProfileRequests.requestProfileId, userRecord!.profileId!));

    expect(joinRequests).toHaveLength(2);

    const targetProfileIds = joinRequests.map((r) => r.targetProfileId).sort();
    const expectedProfileIds = [
      org1.organizationProfile.id,
      org2.organizationProfile.id,
    ].sort();
    expect(targetProfileIds).toEqual(expectedProfileIds);
  });
});

test.describe('Onboarding - Domain-matched organization', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  test.beforeAll(() => {
    supabaseAdmin = createSupabaseAdminClient();
  });

  test('user with domain-matched org sees search screen with org pre-selected as chip', async ({
    page,
  }) => {
    const testId = randomUUID().slice(0, 6);

    const org = await createOrganization({
      testId,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
      organizationName: 'DomainMatchOrg',
    });

    // Set the org domain to oneproject.org so it matches the test user's email
    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, org.organization.id));

    const email = `e2e-domain-match-user-${testId}@oneproject.org`;
    const authUser = await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Fill personal details
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Full Name').fill('Domain Match User');
    await page.getByLabel('Headline').fill('Test Engineer');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should see the unified search screen
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).toBeVisible({ timeout: 15000 });

    // The matched org should appear as a pre-selected chip
    const orgName = `DomainMatchOrg-${testId}`;
    await expect(page.getByText(orgName)).toBeVisible();

    // "Continue with 1 organization" button should be visible
    await expect(
      page.getByRole('button', { name: /Continue with.*organization/ }),
    ).toBeVisible();

    // "Skip for now" should NOT be visible since an org is pre-selected
    await expect(
      page.getByRole('button', { name: 'Skip for now' }),
    ).not.toBeVisible();

    // Click continue
    await page
      .getByRole('button', { name: /Continue with.*organization/ })
      .click();

    // Should see the ToS screen
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });

    // Accept ToS and Privacy Policy
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click({ force: true });
    await checkboxes.nth(1).click({ force: true });

    // Click "Join Common"
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');

    // Verify the user was auto-joined to the organization
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    expect(userRecord).toBeTruthy();

    const [orgUserRecord] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.authUserId, authUser.id),
          eq(organizationUsers.organizationId, org.organization.id),
        ),
      );

    expect(orgUserRecord).toBeTruthy();
  });
});
