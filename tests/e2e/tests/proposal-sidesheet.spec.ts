import { ProposalStatus } from '@op/db/schema';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/**
 * The collab mock (@op/collab/testing) serves fixture content for any doc ID
 * that doesn't contain "nonexistent", so the seeded proposal renders a body.
 */
const MOCK_DOC_ID = 'test-sidesheet-doc';

const PROPOSAL_TITLE = 'Enhance pedestrian crosswalk visibility';

/**
 * Reading a proposal used to cost a navigation, which threw away the list's
 * filters, scroll position and map viewport. The title now opens a side sheet
 * over the list (ONE-1670) — and stays a link, so the proposal's own page is
 * still one modified click or one "Open full proposal" away.
 */
test.describe('Proposal side sheet', () => {
  test('a proposal title opens the sheet without leaving the list', async ({
    authenticatedPage,
    org,
  }) => {
    const { instanceSlug, profileId } = await seedOneProposalDecision(org);
    const listUrl = `/en/decisions/${instanceSlug}/current?filter=all`;

    await openProposalList(authenticatedPage, listUrl);

    const titleLink = authenticatedPage.getByRole('link', {
      name: PROPOSAL_TITLE,
    });
    // The link keeps pointing at the proposal's page, which is what a
    // middle-click and "Copy link address" hand the reader.
    await expect(titleLink).toHaveAttribute(
      'href',
      new RegExp(`/proposal/${profileId}$`),
    );

    await titleLink.click();

    const sheet = authenticatedPage.getByRole('dialog', { name: 'Proposal' });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole('heading', { name: PROPOSAL_TITLE }),
    ).toBeVisible();

    // Still the list route, with the open proposal recorded in the URL so the
    // panel is linkable and Back closes it.
    await expect(authenticatedPage).toHaveURL(
      new RegExp(
        `/decisions/${instanceSlug}/current\\?.*proposalPanel=${profileId}`,
      ),
    );

    // Browser Back is the other way out, and it leaves the list standing.
    await authenticatedPage.goBack();
    await expect(sheet).toBeHidden();
    await expect(titleLink).toBeVisible();
  });

  test('the close button dismisses the sheet and clears the URL', async ({
    authenticatedPage,
    org,
  }) => {
    const { instanceSlug, profileId } = await seedOneProposalDecision(org);

    await openProposalList(
      authenticatedPage,
      `/en/decisions/${instanceSlug}/current?filter=all`,
    );
    await authenticatedPage.getByRole('link', { name: PROPOSAL_TITLE }).click();

    const sheet = authenticatedPage.getByRole('dialog', { name: 'Proposal' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('button', { name: 'Close' }).click();

    await expect(sheet).toBeHidden();
    await expect(authenticatedPage).not.toHaveURL(
      new RegExp(`proposalPanel=${profileId}`),
    );
  });

  test('the expand control hands the reader to the proposal page', async ({
    authenticatedPage,
    org,
  }) => {
    const { instanceSlug, profileId } = await seedOneProposalDecision(org);

    await openProposalList(
      authenticatedPage,
      `/en/decisions/${instanceSlug}/current?filter=all`,
    );
    await authenticatedPage.getByRole('link', { name: PROPOSAL_TITLE }).click();

    const sheet = authenticatedPage.getByRole('dialog', { name: 'Proposal' });
    await sheet.getByRole('link', { name: 'Open full proposal' }).click();

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/decisions/${instanceSlug}/proposal/${profileId}`),
    );
    // The same generous budget `openProposalList` uses: this is a fresh route
    // render, which under a parallel run can take well past the 5s default.
    await expect(
      authenticatedPage.getByRole('heading', { name: PROPOSAL_TITLE }),
    ).toBeVisible({ timeout: 30_000 });
  });
});

/** One submitted proposal — a draft would be filtered out of the list. */
async function seedOneProposalDecision(org: CreateOrganizationResult) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
  });

  const proposal = await createProposal({
    processInstanceId: instance.instance.id,
    submittedByProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    status: ProposalStatus.SUBMITTED,
    proposalData: { title: PROPOSAL_TITLE, collaborationDocId: MOCK_DOC_ID },
  });

  return { instanceSlug: instance.slug, profileId: proposal.profileId };
}

/** Navigates to the list and waits for the seeded card to render. */
async function openProposalList(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('link', { name: PROPOSAL_TITLE })).toBeVisible({
    timeout: 30_000,
  });
}
