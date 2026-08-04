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
    const PAGE_LIMIT = 24;
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

    // Pull the last loaded card into view on each poll tick — this triggers
    // the IntersectionObserver that powers `useInfiniteScroll` and cascades
    // through the remaining pages. Re-resolving `.last()` every tick (and
    // swallowing a detach) survives the masonry re-distributing its nodes as
    // columns settle, which would otherwise throw "not attached to the DOM".
    await expect
      .poll(
        async () => {
          await proposalLink
            .last()
            .scrollIntoViewIfNeeded()
            .catch(() => {});
          return proposalLink.count();
        },
        {
          timeout: 30_000,
          message:
            'after scrolling to the bottom, all proposals across pages should render',
        },
      )
      .toBe(TOTAL_PROPOSALS);
  });

  /**
   * Map browse mode renders the sentinel inside the list column, and that
   * column mounts late — behind the Suspense boundary around the map's pin
   * query — so this guards the callback-ref observer attach in
   * `useIntersectionObserver` (a ref-object observer set up before the
   * sentinel mounts never fires; see the map-view infinite scroll fix).
   */
  test('map view list column loads remaining proposals when scrolling', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    const process = await createDecisionProcess({
      createdByProfileId: org.organizationProfile.id,
      name: `Infinite Scroll Map Listing ${Date.now()}`,
    });

    // A template with a location field puts the process in map browse mode
    // (map is the default view when the template collects a location).
    const { instance, slug, name } = await createDecisionInstance({
      processId: process.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: process.processSchema,
      proposalTemplate: {
        type: 'object',
        required: ['title'],
        'x-field-order': ['title', 'location'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            'x-format': 'short-text',
          },
          location: {
            type: 'object',
            title: 'Location',
            'x-format': 'location',
          },
        },
      },
    });

    // Keep in sync with PROPOSALS_PAGE_LIMIT in ProposalsList.tsx.
    const PAGE_LIMIT = 24;
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

    await authenticatedPage.goto(
      `/en/decisions/${slug}/current?filter=all&view=map`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({
      timeout: 30_000,
    });

    const proposalLink = authenticatedPage.getByRole('link', {
      name: MOCK_PROPOSAL_TITLE,
    });

    // First page lands at PAGE_LIMIT — proving the list column is paginated,
    // not the full set.
    await expect(proposalLink.first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => proposalLink.count(), {
        timeout: 30_000,
        message: 'first page should load PAGE_LIMIT proposals',
      })
      .toBe(PAGE_LIMIT);

    // The map column is sticky; the list column drives page height, so pulling
    // the last card into view brings the in-column sentinel into the viewport.
    await proposalLink.last().scrollIntoViewIfNeeded();

    await expect
      .poll(() => proposalLink.count(), {
        timeout: 30_000,
        message:
          'after scrolling the list column, all proposals across pages should render',
      })
      .toBe(TOTAL_PROPOSALS);
  });
});
