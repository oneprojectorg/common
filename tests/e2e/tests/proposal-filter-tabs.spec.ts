import { ProposalStatus, users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

const MY_PROPOSAL_TITLE = 'My Riverside Bike Path';
const OTHER_PROPOSAL_TITLE = 'Their Downtown Mural';

/**
 * One proposal submitted by the signed-in user's own profile and one submitted
 * by the organization, so "My proposals" has something to exclude.
 *
 * The owning profile is read back from `users.current_profile_id` rather than
 * assumed to be `adminUser.profileId`: that column is what the app resolves
 * `currentProfile` from, and it is what the list filters on. They match today
 * because the signup trigger writes both, but a spec that switches profiles
 * would otherwise invert this test silently instead of failing.
 */
async function createListingWithOneOwnProposal(org: {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string; profileId: string };
}) {
  const [userRecord] = await db
    .select({ currentProfileId: users.currentProfileId })
    .from(users)
    .where(eq(users.authUserId, org.adminUser.authUserId));

  const myProfileId = userRecord?.currentProfileId;
  if (!myProfileId) {
    throw new Error(
      'Expected the test user to have a current profile — the list filters "My proposals" on it',
    );
  }

  const process = await createDecisionProcess({
    createdByProfileId: org.organizationProfile.id,
    name: `Proposal Filter Tabs ${Date.now()}`,
  });

  const { instance, slug, name } = await createDecisionInstance({
    processId: process.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: process.processSchema,
  });

  await createProposal({
    processInstanceId: instance.id,
    submittedByProfileId: myProfileId,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    status: ProposalStatus.SUBMITTED,
    proposalData: {
      title: MY_PROPOSAL_TITLE,
      description: `<p>${MY_PROPOSAL_TITLE} details.</p>`,
    },
  });

  await createProposal({
    processInstanceId: instance.id,
    submittedByProfileId: org.organizationProfile.id,
    status: ProposalStatus.SUBMITTED,
    proposalData: {
      title: OTHER_PROPOSAL_TITLE,
      description: `<p>${OTHER_PROPOSAL_TITLE} details.</p>`,
    },
  });

  return { slug, name };
}

test.describe('Proposal filter tabs', () => {
  /**
   * The tab bar is the only proposal-filter control on this surface — the bar's
   * filter select moved into it, so a member can reach their own submissions
   * without opening a dropdown.
   */
  test('narrows the list to proposals the reader submitted', async ({
    authenticatedPage,
    org,
  }) => {
    const { slug, name } = await createListingWithOneOwnProposal(org);

    await authenticatedPage.goto(`/en/decisions/${slug}/current`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    const mine = authenticatedPage.getByRole('link', {
      name: MY_PROPOSAL_TITLE,
    });
    const theirs = authenticatedPage.getByRole('link', {
      name: OTHER_PROPOSAL_TITLE,
    });

    await expect(mine).toBeVisible({ timeout: 30_000 });
    await expect(theirs).toBeVisible();

    const allTab = authenticatedPage.getByRole('tab', {
      name: 'All proposals',
    });
    const myTab = authenticatedPage.getByRole('tab', { name: 'My proposals' });
    await expect(allTab).toHaveAttribute('aria-selected', 'true');

    // The select the tabs replaced. Anchored at the end so the category
    // select's "Filter proposals by category" doesn't match.
    await expect(
      authenticatedPage.getByRole('combobox', { name: /Filter proposals$/ }),
    ).toBeHidden();

    await myTab.click();

    await expect(theirs).toBeHidden({ timeout: 15_000 });
    await expect(mine).toBeVisible();
    await expect(myTab).toHaveAttribute('aria-selected', 'true');
    // Filtered in SQL, so the count narrows to the tab's own total rather than
    // counting the cards that happen to be loaded. ProposalCount splits the
    // narrowed form across two spans, so assert the pair — the denominator
    // alone would also pass on a count of zero.
    await expect(
      authenticatedPage
        .getByRole('status')
        .filter({ hasText: 'of 2 proposals' }),
    ).toHaveText(/^1\s*of 2 proposals$/);

    // The tab writes the same URL state the select used to, so the view is
    // shareable and survives a reload.
    expect(new URL(authenticatedPage.url()).searchParams.get('filter')).toBe(
      'my-proposals',
    );

    await allTab.click();
    await expect(theirs).toBeVisible({ timeout: 15_000 });
  });

  /** A link carrying the filter arrives with the matching tab already active. */
  test('selects the tab a deep link asks for', async ({
    authenticatedPage,
    org,
  }) => {
    const { slug, name } = await createListingWithOneOwnProposal(org);

    await authenticatedPage.goto(
      `/en/decisions/${slug}/current?filter=my-proposals`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      authenticatedPage.getByRole('tab', { name: 'My proposals' }),
    ).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await expect(
      authenticatedPage.getByRole('link', { name: MY_PROPOSAL_TITLE }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      authenticatedPage.getByRole('link', { name: OTHER_PROPOSAL_TITLE }),
    ).toBeHidden();
  });
});
