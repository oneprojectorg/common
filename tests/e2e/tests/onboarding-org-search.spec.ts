import { joinProfileRequests, organizations, users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
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

  test('user without domain-matched org sees search screen and can skip to app', async ({
    page,
  }) => {
    // Use a domain that won't match any existing org
    const email = `e2e-org-search-skip-${randomUUID().slice(0, 6)}@no-match-domain-test.example.com`;
    const authUser = await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Step 1: Should see the personal details form first
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    // Fill in required fields
    await page.getByLabel('Full Name').fill('Test User Skip');
    await page.getByLabel('Headline').fill('Test Engineer');

    // Email field is pre-populated with the auth email; fill it in case it's empty
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);

    // Submit personal details
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Should see the organization search screen (not org creation)
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).toBeVisible({ timeout: 15000 });

    // Step 3: Click "Skip for now"
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Step 4: Should see the ToS acceptance screen
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });

    // Step 5: Accept ToS and Privacy Policy checkboxes
    // Each checkbox label is "I accept the" with the link text in a sibling element
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click(); // Terms of Service
    await checkboxes.nth(1).click(); // Privacy Policy

    // Step 6: Click "Join Common"
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Step 7: Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');

    // Step 8: Verify no join requests were created for this user
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (userRecord?.profileId) {
      const joinRequests = await db
        .select()
        .from(joinProfileRequests)
        .where(
          eq(joinProfileRequests.requestProfileId, userRecord.profileId),
        );

      expect(joinRequests).toHaveLength(0);
    }
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

    // Create a new user with no domain match
    const email = `e2e-org-search-select-${testId}@no-match-domain-test.example.com`;
    const authUser = await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Step 1: Fill personal details
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Full Name').fill('Test User Search');
    await page.getByLabel('Headline').fill('Test Engineer');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Should see the organization search screen
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).toBeVisible({ timeout: 15000 });

    // Step 3: Search for organizations using the unique prefix
    const searchInput = page.getByRole('textbox', {
      name: 'Search or add your organization...',
    });
    await searchInput.fill(searchPrefix);

    // Wait for search results dropdown to appear with our orgs
    const org1Name = `${searchPrefix} Alpha-${testId}-org1`;
    const org2Name = `${searchPrefix} Beta-${testId}-org2`;
    await expect(page.getByText(org1Name).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(org2Name).first()).toBeVisible();

    // Step 4: Select first org - should appear as a chip
    await page.getByText(org1Name).first().click();

    // Verify chip appears and "Continue with 1 organizations" button shows
    await expect(
      page.getByRole('button', { name: /Continue with 1 organization/ }),
    ).toBeVisible();

    // "Skip for now" should be hidden when orgs are selected
    await expect(
      page.getByRole('button', { name: 'Skip for now' }),
    ).not.toBeVisible();

    // Step 5: Search and select second org
    await searchInput.fill(searchPrefix);
    await expect(page.getByText(org2Name).first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByText(org2Name).first().click();

    // Verify count updates to 2
    await expect(
      page.getByRole('button', { name: /Continue with 2 organization/ }),
    ).toBeVisible();

    // Step 6: Click "Continue with 2 organizations"
    await page
      .getByRole('button', { name: /Continue with 2 organization/ })
      .click();

    // Step 7: Should see ToS screen
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });

    // Step 8: Accept ToS and Privacy Policy
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // Step 9: Click "Join Common"
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Step 10: Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');

    // Step 11: Verify join requests were created for both orgs
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    expect(userRecord?.profileId).toBeTruthy();

    const joinRequests = await db
      .select()
      .from(joinProfileRequests)
      .where(
        eq(joinProfileRequests.requestProfileId, userRecord!.profileId!),
      );

    expect(joinRequests).toHaveLength(2);

    // Verify requests target the correct organizations
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

  test('user with domain-matched org sees MatchingOrganizationsForm and can join', async ({
    page,
  }) => {
    const testId = randomUUID().slice(0, 6);
    const emailDomain = `e2e-domain-match-${testId}.com`;

    // Create an organization and set its domain to match the user's email
    const org = await createOrganization({
      testId,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
      organizationName: 'DomainMatchOrg',
    });

    // Set the organization's domain to match the user's email domain
    await db
      .update(organizations)
      .set({ domain: emailDomain })
      .where(eq(organizations.id, org.organization.id));

    // Create a user whose email matches the org domain
    const email = `e2e-domain-match-user-${testId}@${emailDomain}`;
    await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Step 1: Fill personal details
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Full Name').fill('Domain Match User');
    await page.getByLabel('Headline').fill('Test Engineer');
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Should see MatchingOrganizationsForm (not the search screen)
    await expect(
      page.getByRole('heading', { name: "We've found your organization" }),
    ).toBeVisible({ timeout: 15000 });

    // Verify the matched organization is displayed with its name
    const orgName = `DomainMatchOrg-${testId}`;
    await expect(page.getByText(orgName)).toBeVisible();

    // Verify the "Get Started + Add My Organization" button is NOT present
    await expect(
      page.getByRole('button', { name: /Add My Organization/i }),
    ).not.toBeVisible();

    // Verify the "Find organizations you belong to" heading is NOT shown
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).not.toBeVisible();

    // Step 3: Accept ToS and Privacy Policy
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // Step 4: Click "Get Started" to join the org
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Step 5: Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');
  });
});
