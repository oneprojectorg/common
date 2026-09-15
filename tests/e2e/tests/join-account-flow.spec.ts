import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
  makeDecisionPublic,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Header "Join" flow on public decisions: the header swaps "Log in" for
 * "Join" when the viewer can submit proposals without an account, and the
 * JoinAccountModal claims a full account inline (email → promote onboarding),
 * minting an anonymous Supabase user on demand for no-session visitors.
 *
 * Note: e2e Supabase has email confirmations off, so entering the email
 * applies immediately (no OTP screen) and navigates straight to
 * /start?promote=1. The OTP branch is not coverable here.
 *
 * The logged-out + non-public case isn't asserted: a no-session visitor on a
 * non-public decision gets the forbidden screen, which doesn't render the
 * decision header at all.
 */
test.describe('Join account flow (public decision header)', () => {
  // Start with no session; tests establish their own auth state.
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

  test('logged-out visitor claims an account via the header Join modal', async ({
    page,
  }) => {
    const { instance } = await seedPublicDecision('join');

    // No session at all — the modal mints the anonymous user itself.
    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    await page.getByRole('button', { name: 'Join' }).click();
    await expect(
      page.getByRole('heading', { name: 'Add your voice to this idea' }),
    ).toBeVisible({ timeout: 15000 });

    const email = `join-${randomUUID().slice(0, 8)}@example.com`;
    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    // By role, not by label: the claim modal's channel tabs give the panel
    // an accessible name from its tab, so `getByLabel('Email')` matches the
    // tabpanel as well as the input.
    await dialog.getByRole('textbox', { name: 'Email' }).fill(email);

    // Confirmations are off in e2e, so submitting the email claims the account
    // immediately and navigates to the promote onboarding.
    await dialog.getByRole('button', { name: 'Email me a code' }).click();
    await page.waitForURL(/\/start\?.*promote=1/, { timeout: 20000 });
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).not.toBeVisible();
  });

  test('logged-out visitor joins from the proposal view page', async ({
    page,
  }) => {
    const { org, instance } = await seedPublicDecision('join-prop');
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: `Join prompt proposal ${randomUUID().slice(0, 6)}`,
      },
      status: ProposalStatus.SUBMITTED,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { waitUntil: 'networkidle' },
    );

    // The comments composer slot shows the claim prompt for visitors; the
    // header offers Join rather than Log in.
    await expect(
      page.getByText('Join Common to comment on this proposal.'),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('button', { name: 'Log in' }),
    ).not.toBeVisible();

    // Either Join button (header or prompt) opens the claim modal mounted by
    // the proposal view layout.
    await page.getByRole('button', { name: 'Join' }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Add your voice to this idea' }),
    ).toBeVisible({ timeout: 15000 });

    const email = `join-${randomUUID().slice(0, 8)}@example.com`;
    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    // By role, not by label: the claim modal's channel tabs give the panel
    // an accessible name from its tab, so `getByLabel('Email')` matches the
    // tabpanel as well as the input.
    await dialog.getByRole('textbox', { name: 'Email' }).fill(email);
    await dialog.getByRole('button', { name: 'Email me a code' }).click();
    await page.waitForURL(/\/start\?.*promote=1/, { timeout: 20000 });
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).not.toBeVisible();
  });

  /**
   * The Figma annotation on "Add your voice to this idea" is that the dialog
   * appears when the user clicks Like, so the toggle is a second door into the
   * claim flow rather than a dead count. Without the hook handing `join=1` to
   * the layout's modal, a visitor who can't like would press an unresponsive
   * button — the state this replaces, and the one no other spec asserts.
   *
   * Given a logged-out visitor on a public decision's proposal page
   * When they press Like
   * Then the claim dialog opens, and the like is not written
   */
  test("a visitor's Like opens the claim dialog instead of doing nothing", async ({
    page,
  }) => {
    const { org, instance } = await seedPublicDecision('join-like');
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: `Like prompt proposal ${randomUUID().slice(0, 6)}`,
      },
      status: ProposalStatus.SUBMITTED,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { waitUntil: 'networkidle' },
    );

    // The control has to actually render for a visitor — the engagement row
    // falls back to plain counts whenever the hook declines to act. Name is
    // count-prefixed ("0 Likes"), so match the whole label, not `Like`.
    const like = page.getByRole('button', { name: /^\d+ Likes$/ });
    await expect(like).toBeVisible({ timeout: 15000 });

    await like.click();

    await expect(
      page.getByRole('heading', { name: 'Add your voice to this idea' }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/join=1/);

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(
      dialog.getByRole('button', { name: 'Email me a code' }),
    ).toBeVisible();

    // The visitor can't like, so the click must not have liked anything.
    await expect(like).toHaveAccessibleName('0 Likes');
  });

  test('a full account sees the user menu, not Join, and ?join=1 opens nothing', async ({
    page,
  }) => {
    const { org, instance } = await seedPublicDecision('nojoin');

    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await page.goto(`/en/decisions/${instance.slug}?join=1`, {
      waitUntil: 'networkidle',
    });

    // Anchor on the decision header being rendered before asserting absences.
    // .first(): the header renders the title twice (responsive md variants).
    await expect(
      page.getByRole('heading', { name: instance.name }).first(),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole('heading', { name: 'Add your voice to this idea' }),
    ).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Join' })).not.toBeVisible();
  });
});
