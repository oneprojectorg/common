import { ProposalStatus } from '@op/db/schema';
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
 * by the organization, so "My proposals" has something to exclude. The signup
 * trigger points `users.current_profile_id` at the individual profile, which is
 * the id the list filters on.
 */
async function createListingWithOneOwnProposal(org: {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string; profileId: string };
}) {
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
    submittedByProfileId: org.adminUser.profileId,
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
    // counting the cards that happen to be loaded.
    await expect(authenticatedPage.getByText('of 2 proposals')).toBeVisible();

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
