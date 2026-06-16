import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

const MOCK_DOC_ID = 'test-proposal-listing-doc';

/**
 * Zero-padded so titles render with a stable shape — the regex assertion
 * `^Proposal \d{3}$` relies on it.
 */
const proposalTitle = (n: number) => `Proposal ${String(n).padStart(3, '0')}`;

test.describe('Proposal Listing — Infinite Scroll', () => {
  /**
   * The client requests proposals in pages of 50; create 55 so the first page
   * leaves work for the infinite-scroll sentinel to fetch.
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

    const TOTAL_PROPOSALS = 55;
    const PAGE_LIMIT = 50;

    for (let i = 1; i <= TOTAL_PROPOSALS; i++) {
      await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        status: ProposalStatus.SUBMITTED,
        proposalData: {
          title: proposalTitle(i),
          collaborationDocId: MOCK_DOC_ID,
        },
      });
    }

    await authenticatedPage.goto(`/en/decisions/${slug}?filter=all`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(authenticatedPage.getByRole('heading', { name })).toBeVisible({
      timeout: 30_000,
    });

    const proposalLink = authenticatedPage.getByRole('link', {
      name: /^Proposal \d{3}$/,
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
