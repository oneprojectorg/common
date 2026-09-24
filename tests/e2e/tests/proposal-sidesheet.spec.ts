import { ProposalStatus } from '@op/db/schema';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/** The collab mock serves fixture content for any ID without "nonexistent". */
const MOCK_DOC_ID = 'test-sidesheet-doc';

const PROPOSAL_TITLE = 'Enhance pedestrian crosswalk visibility';

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
    // Still a real link, so a middle-click still reaches the page.
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

    await expect(authenticatedPage).toHaveURL(
      new RegExp(
        `/decisions/${instanceSlug}/current\\?.*proposalPanel=${profileId}`,
      ),
    );

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

  test('the header offers Report between expand and close', async ({
    authenticatedPage,
    org,
  }) => {
    const { instanceSlug } = await seedOneProposalDecision(org);

    await openProposalList(
      authenticatedPage,
      `/en/decisions/${instanceSlug}/current?filter=all`,
    );
    await authenticatedPage.getByRole('link', { name: PROPOSAL_TITLE }).click();

    const sheet = authenticatedPage.getByRole('dialog', { name: 'Proposal' });
    // Report only appears once the proposal resolves — it needs its id.
    await expect(sheet.getByRole('button', { name: 'Report' })).toBeVisible();

    const headerControls = await sheet.evaluate((element) =>
      [...element.querySelectorAll('a[aria-label], button[aria-label]')]
        .slice(0, 3)
        .map((control) => control.getAttribute('aria-label')),
    );
    expect(headerControls).toEqual(['Open full proposal', 'Report', 'Close']);
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
    // A fresh route render, which under a parallel run outruns the 5s default.
    await expect(
      authenticatedPage.getByRole('heading', { name: PROPOSAL_TITLE }),
    ).toBeVisible({ timeout: 30_000 });
  });
});

/**
 * Below `sm` the panel is a full-screen modal, not a side sheet. Geometry is
 * the contract, as in `mobile-fullscreen-modal.spec.ts`, so it is measured.
 */
test.describe('Proposal side sheet on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fills the viewport with no edge border', async ({
    authenticatedPage,
    org,
  }) => {
    const { instanceSlug } = await seedOneProposalDecision(org);

    await openProposalList(
      authenticatedPage,
      `/en/decisions/${instanceSlug}/current?filter=all`,
    );
    await authenticatedPage.getByRole('link', { name: PROPOSAL_TITLE }).click();

    const sheet = authenticatedPage.getByRole('dialog', { name: 'Proposal' });
    await expect(sheet).toBeVisible();

    const geometry = await sheet.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        borderInlineStart: getComputedStyle(element).borderLeftWidth,
      };
    });

    expect(geometry.x).toBe(0);
    expect(geometry.y).toBe(0);
    expect(geometry.width).toBe(geometry.viewportWidth);
    expect(geometry.height).toBe(geometry.viewportHeight);
    // The hairline that would give it away as a panel rather than a modal.
    expect(geometry.borderInlineStart).toBe('0px');
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
