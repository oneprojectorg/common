import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Pre-seeded in the collab mock (@op/collab/testing). The proposal card title
 * is rendered from this doc's `title` fragment — NOT from `proposalData.title`
 * — so every card created against this doc renders the same title below.
 */
const MOCK_DOC_ID = 'test-proposal-listing-doc';
const MOCK_PROPOSAL_TITLE = 'Community Garden Project';

test.describe('Proposal Listing — Infinite Scroll', () => {
  /**
   * The client requests proposals one page at a time (PAGE_LIMIT); create more
   * than a page so the first page leaves work for the infinite-scroll sentinel
   * to fetch. Cards all share MOCK_PROPOSAL_TITLE (title comes from the seeded
   * collab doc), so we count the title links rather than asserting per-title.
   */
  test('loads remaining proposals when scrolling past the first page', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    const process = await createDecisionProcess({
      createdByProfileId: org.organizationProfile.id,
      name: `Infinite Scroll Listing ${Date.now()}`,
    });

    const { instance, slug, name } = await createDecisionInstance({
      processId: process.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: process.processSchema,
    });

    // Keep in sync with PROPOSALS_PAGE_LIMIT in ProposalsList.tsx.
    const PAGE_LIMIT = 51;
    const TOTAL_PROPOSALS = PAGE_LIMIT + 4;

    for (let i = 1; i <= TOTAL_PROPOSALS; i++) {
      await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        status: ProposalStatus.SUBMITTED,
        proposalData: {
          title: `Proposal ${i}`,
          collaborationDocId: MOCK_DOC_ID,
        },
      });
    }

    await authenticatedPage.goto(`/en/decisions/${slug}/current?filter=all`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({
      timeout: 30_000,
    });

    const proposalLink = authenticatedPage.getByRole('link', {
      name: MOCK_PROPOSAL_TITLE,
    });

    // First page lands at PAGE_LIMIT — not the full TOTAL_PROPOSALS — otherwise
    // the test would pass without infinite scroll wired up at all.
    await expect(proposalLink.first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => proposalLink.count(), {
        timeout: 30_000,
        message: 'first page should load PAGE_LIMIT proposals',
      })
      .toBe(PAGE_LIMIT);

    // Pull the last loaded card into view — survives nested scroll containers
    // that `window.scrollTo` would miss, and is what triggers the
    // IntersectionObserver that powers `useInfiniteScroll`.
    await proposalLink.last().scrollIntoViewIfNeeded();

    await expect
      .poll(() => proposalLink.count(), {
        timeout: 30_000,
        message:
          'after scrolling to the bottom, all proposals across pages should render',
      })
      .toBe(TOTAL_PROPOSALS);
  });
});
