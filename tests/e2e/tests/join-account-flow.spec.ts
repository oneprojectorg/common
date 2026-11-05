import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
  makeDecisionPublic,
  readProfileNameByEmail,
  TEST_PERMISSION_BITS,
} from '@op/common/testing/data';
import { ProposalStatus } from '@op/db/schema';
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
   * claim flow rather than a dead count. Without the hook handing the trigger
   * (`join=like` plus the pending action) to the layout's modal, a visitor who
   * can't like would press an unresponsive button — the state this replaces,
   * and the one no other spec asserts.
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
    await expect(page).toHaveURL(/join=like/);
    // The pending action rides beside the trigger, ready to replay after the
    // claim.
    await expect(page).toHaveURL(/resume=like%3A/);

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(
      dialog.getByRole('button', { name: 'Email me a code' }),
    ).toBeVisible();

    // The visitor can't like, so the click must not have liked anything.
    // Dismiss the claim dialog first: while it's open it hides the background
    // from the accessibility tree, so the count can't be read until it closes.
    // The name assertion retries until the button is reachable again.
    await dialog
      .getByRole('button', { name: 'Browse proposals for now' })
      .click();
    await expect(like).toHaveAccessibleName('0 Likes');
  });

  /**
   * The follow half of the trigger: nothing else presses Follow as a visitor,
   * so the hook wiring and the follow-keyed modal copy are otherwise
   * unexercised above the pure functions. Dismissing the dialog must also
   * cancel the carried action — both params, or a later claim replays it.
   *
   * Given a logged-out visitor on a public decision's proposal page
   * When they press Follow and then dismiss the claim dialog
   * Then the dialog shows the follow copy with join=follow and
   * resume=follow: carried, and dismissing strips both without following
   */
  test("a visitor's Follow opens the claim dialog with follow copy, and closing cancels it", async ({
    page,
  }) => {
    const { org, instance } = await seedPublicDecision('join-follow');
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: `Follow prompt proposal ${randomUUID().slice(0, 6)}`,
      },
      status: ProposalStatus.SUBMITTED,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { waitUntil: 'networkidle' },
    );

    const follow = page.getByRole('button', { name: /^\d+ Followers?$/ });
    await expect(follow).toBeVisible({ timeout: 15000 });
    await follow.click();

    // Follow-keyed copy, not the generic like pair.
    await expect(
      page.getByRole('heading', { name: "Don't lose track of this idea" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/join=follow/);
    await expect(page).toHaveURL(/resume=follow%3A/);

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await dialog
      .getByRole('button', { name: 'Browse proposals for now' })
      .click();

    // Dismissing cancels the whole pending action: nothing followed, and
    // neither param survives to re-open the modal or arm a later replay.
    await expect(follow).toHaveAccessibleName('0 Followers');
    await expect(page).not.toHaveURL(/join=/);
    await expect(page).not.toHaveURL(/resume=/);
  });

  /**
   * The replay seam no other test stitches together: the pending like must
   * survive the whole claim round trip — modal, promote onboarding, the
   * return redirect — and apply exactly once when the new member lands back.
   * This also exercises the stay-anonymous branch, which writes nothing.
   *
   * Given a logged-out visitor who pressed Like on a public proposal
   * When they claim an account and finish onboarding staying anonymous
   * Then they return to the proposal with the like applied and announced,
   * the carrier param is stripped, and a reload does not replay it
   */
  test("a visitor's Like replays once after the claim completes", async ({
    page,
  }) => {
    const { org, instance } = await seedPublicDecision('join-resume');
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: `Resume replay proposal ${randomUUID().slice(0, 6)}`,
      },
      status: ProposalStatus.SUBMITTED,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { waitUntil: 'networkidle' },
    );

    const like = page.getByRole('button', { name: /^\d+ Likes?$/ });
    await expect(like).toBeVisible({ timeout: 15000 });
    await like.click();

    await expect(
      page.getByRole('heading', { name: 'Add your voice to this idea' }),
    ).toBeVisible({ timeout: 15000 });

    const email = `join-${randomUUID().slice(0, 8)}@example.com`;
    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await dialog.getByRole('textbox', { name: 'Email' }).fill(email);
    // Confirmations are off in e2e, so this claims the account immediately and
    // navigates to the promote onboarding with the pending action in tow.
    await dialog.getByRole('button', { name: 'Email me a code' }).click();
    await page.waitForURL(/\/start\?.*promote=1/, { timeout: 20000 });

    // Visibility step: stay anonymous. The replay must not depend on the
    // rename path.
    await expect(
      page.getByRole('heading', { name: "How you'll appear in this process" }),
    ).toBeVisible({ timeout: 15000 });
    // React Aria renders a decorative box over the input, so force the click
    // past it rather than targeting the visually-hidden radio center.
    await page
      .getByRole('radio', { name: 'Stay anonymous' })
      .check({ force: true });
    await page.getByRole('button', { name: 'Continue' }).click();

    // ToS step.
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });
    const accept = page.getByRole('checkbox', { name: 'I accept the' });
    await accept.nth(0).check({ force: true });
    await accept.nth(1).check({ force: true });
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Back on the proposal page, the pending like applies and is announced.
    // .first(): the toast and the sr-only live region carry the same text.
    await expect(page).toHaveURL(
      new RegExp(`/proposal/${proposal.profileId}`),
      { timeout: 20000 },
    );
    await expect(page.getByText('Your like was counted').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(like).toHaveAccessibleName('1 Like');
    // Settling strips the carrier, so history can't re-arm the replay.
    await expect(page).not.toHaveURL(/resume=/);

    // One-shot: a reload reads the count back from the server and must not
    // write again.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(
      page.getByRole('button', { name: /^\d+ Likes?$/ }),
    ).toHaveAccessibleName('1 Like');

    // Stay anonymous wrote nothing: the trigger's name survives completion.
    await expect
      .poll(() => readProfileNameByEmail(email), { timeout: 15000 })
      .toMatch(/^Participant \d+$/);
  });

  /**
   * The dropped-action path: a carried like that can no longer apply must
   * fail loudly once, not evaporate. Here engagement was never grantable —
   * the public grant carries READ only — standing in for access revoked
   * between the click and the return. The proof is seeded directly because
   * the grant that would let a browser save it by clicking Like is exactly
   * what this scenario lacks (key and format from pendingEngagement.ts).
   *
   * Given a signed-in outsider on a read-only public decision's proposal
   * And a saved pending like whose access no longer allows engaging
   * When the page loads with the carried action
   * Then the failure toast shows once, no success fires, and the param is
   * stripped so the failure cannot repeat
   */
  test('a carried like that can no longer apply fails with one toast', async ({
    page,
  }) => {
    const suffix = randomUUID().slice(0, 6);
    const org = await createOrganization({
      testId: `join-fail-${suffix}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    const outsider = await createOrganization({
      testId: `join-fail-out-${suffix}`,
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
    // Readable by anyone, engageable by no outsider: no SUBMIT_PROPOSALS bit.
    await makeDecisionPublic({
      profileId: instance.profileId,
      permissionBits: TEST_PERMISSION_BITS.READ,
    });
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: `Fail toast proposal ${suffix}`,
      },
      status: ProposalStatus.SUBMITTED,
    });

    await authenticateAsUser(page, {
      email: outsider.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    const pendingRaw = `like:${proposal.profileId}`;
    await page.addInitScript(
      ({ key, value }) => {
        window.sessionStorage.setItem(key, value);
      },
      { key: 'pendingEngagementProof', value: pendingRaw },
    );

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}?resume=${encodeURIComponent(pendingRaw)}`,
      { waitUntil: 'networkidle' },
    );

    // One loud failure, no phantom success, and the carrier is gone.
    await expect(page.getByText(/couldn.t be counted/).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('Your like was counted')).not.toBeVisible();
    await expect(page).not.toHaveURL(/resume=/);
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
