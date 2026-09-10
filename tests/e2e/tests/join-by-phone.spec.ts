import {
  createDecisionInstance,
  findAuthUserByPhone,
  getSeededTemplate,
  makeDecisionPublic,
  releaseTestPhoneNumber,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Claiming an account by phone from a public decision's Join modal — the
 * other channel of the flow `join-account-flow.spec.ts` covers by email.
 *
 * The security property under test is that a phone number alone buys nothing.
 * GoTrue's SMS autoconfirm is off (`enable_confirmations = true`), so a claim
 * gets a code screen rather than a session; with it on, anyone reaching GoTrue
 * could take an account against a number they do not hold. Nothing above the
 * config file asserted that until this spec — and unlike email, whose
 * confirmations are off in e2e, the phone code screen is reachable here.
 *
 * Numbers come from `[auth.sms.test_otp]`, which accepts a fixed code and
 * sends nothing. They are a shared, finite resource, so each test takes its
 * own — the run is `fullyParallel` — and frees it first, because the e2e
 * database survives between local runs.
 */
test.describe('Join by phone (public decision)', () => {
  // Start with no session; the modal mints the anonymous user itself.
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  async function seedPublicDecision(testIdPrefix: string) {
    const org = await createOrganization({
      testId: `${testIdPrefix}-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });
    // Public grant includes SUBMIT_PROPOSALS, which is what makes the header
    // offer Join instead of Log in.
    await makeDecisionPublic({ profileId: instance.profileId });
    return { org, instance };
  }

  test('offers both channels, with phone a peer of email', async ({ page }) => {
    const { instance } = await seedPublicDecision('phone-tabs');

    await page.goto(`/en/decisions/${instance.slug}?join=1`, {
      waitUntil: 'networkidle',
    });

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(
      page.getByRole('heading', { name: 'Claim your account' }),
    ).toBeVisible({ timeout: 15000 });

    // Both up front, not one behind a "use a phone instead" link — the design
    // treats the channels as equals, and the tab is the only thing telling a
    // visitor that phone signup exists.
    await expect(dialog.getByRole('tab', { name: 'Email' })).toBeVisible();
    await expect(
      dialog.getByRole('tab', { name: 'Phone number' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Email me a code' }),
    ).toBeVisible();

    await dialog.getByRole('tab', { name: 'Phone number' }).click();

    // The panel swaps the field and the call to action together; a stale
    // "Email me a code" over a phone field would submit to the wrong endpoint.
    await expect(
      dialog.getByRole('textbox', { name: 'Phone number' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Text me a code' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('textbox', { name: 'Email' }),
    ).not.toBeVisible();
  });

  test('a phone number alone creates no account — the code is required', async ({
    page,
  }) => {
    const phone = '+15005550008';
    const { instance } = await seedPublicDecision('phone-otp');
    await releaseTestPhoneNumber(phone);

    await page.goto(`/en/decisions/${instance.slug}?join=1`, {
      waitUntil: 'networkidle',
    });

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await dialog.getByRole('tab', { name: 'Phone number' }).click();
    await dialog.getByRole('textbox', { name: 'Phone number' }).fill(phone);
    await dialog.getByRole('button', { name: 'Text me a code' }).click();

    // This is the assertion the config comment promises: GoTrue answers with a
    // code to enter, not with a claimed account. Landing on /start here would
    // mean autoconfirm had handed out the account for the number alone.
    await expect(page.getByRole('heading', { name: 'Code sent!' })).toBeVisible(
      { timeout: 20000 },
    );
    await expect(dialog.getByRole('textbox', { name: 'Code' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/start/);

    // The number is still free: asking for a code attaches nothing.
    expect(await findAuthUserByPhone(phone)).toBeNull();
  });

  test('the code claims the account, and the account can propose', async ({
    page,
  }) => {
    // Two navigations and a full onboarding pass sit inside this one test,
    // because each step needs the session the previous one produced.
    test.setTimeout(120_000);

    const phone = '+15005550007';
    const code = '234567';
    const { instance } = await seedPublicDecision('phone-claim');
    await releaseTestPhoneNumber(phone);

    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: 'Join' }).click();

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(
      page.getByRole('heading', { name: 'Claim your account' }),
    ).toBeVisible({ timeout: 15000 });

    await dialog.getByRole('tab', { name: 'Phone number' }).click();
    await dialog.getByRole('textbox', { name: 'Phone number' }).fill(phone);
    await dialog.getByRole('button', { name: 'Text me a code' }).click();

    await expect(page.getByRole('heading', { name: 'Code sent!' })).toBeVisible(
      { timeout: 20000 },
    );
    await dialog.getByRole('textbox', { name: 'Code' }).fill(code);
    await dialog.getByRole('button', { name: 'Create profile' }).click();

    // Same destination as the email claim: the promote onboarding, not the
    // walled-garden 403 a non-member used to get here.
    await page.waitForURL(/\/start\?.*promote=1/, { timeout: 30000 });
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).not.toBeVisible();

    // PromoteOnboardingFlow — step 1: personal details.
    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Full Name').fill('Phone Joiner');
    await page.getByLabel('Headline').fill('Joined by text');
    // Onboarding asks for an email even though the auth record has none; it is
    // the app's contact address, not the credential.
    await page
      .getByLabel('Email')
      .fill(`phone-${randomUUID().slice(0, 8)}@example.com`);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: accept Terms of Service + Privacy Policy.
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });
    // React Aria renders a decorative box over the input, so force the click
    // past it rather than targeting the visually-hidden checkbox center.
    const accept = page.getByRole('checkbox', { name: 'I accept the' });
    await accept.nth(0).check({ force: true });
    await accept.nth(1).check({ force: true });
    await page.getByRole('button', { name: 'Join Common' }).click();

    await expect(page).toHaveURL(new RegExp(`/decisions/${instance.slug}`), {
      timeout: 30000,
    });
    await expect(page).not.toHaveURL(/\/start/);

    // The credential really is the phone: no email on the auth record. Network
    // membership reads an email address, so this account is a member of
    // nothing — the public grant is the only thing admitting it below.
    const claimed = await findAuthUserByPhone(phone);
    expect(claimed).not.toBeNull();
    expect(claimed?.email).toBeNull();
    expect(claimed?.isAnonymous).toBe(false);

    // And it can act: "Start a proposal" creates the draft server-side before
    // navigating, so reaching the editor means `createProposal` accepted a
    // caller who holds SUBMIT_PROPOSALS only through the public grant.
    await page.getByRole('button', { name: 'Start a proposal' }).click();
    await page.waitForURL(/\/proposal\/[^/]+\/edit/, { timeout: 30000 });
    await expect(page.getByText('Failed to create proposal')).not.toBeVisible();
  });
});
