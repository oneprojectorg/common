import { ProposalStatus } from '@op/db/schema';
import {
  type CreateOrganizationResult,
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

// Keep in sync with PROPOSALS_PAGE_LIMIT in ProposalsList.tsx.
const PAGE_LIMIT = 24;

const seedDecision = async ({
  org,
  name,
  proposalCount,
}: {
  org: CreateOrganizationResult;
  name: string;
  proposalCount: number;
}) => {
  const process = await createDecisionProcess({
    createdByProfileId: org.organizationProfile.id,
    name: `${name} ${Date.now()}`,
  });

  const instance = await createDecisionInstance({
    processId: process.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: process.processSchema,
  });

  for (let i = 1; i <= proposalCount; i++) {
    await createProposal({
      processInstanceId: instance.instance.id,
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

  return instance;
};

test.describe('Proposal Feed view', () => {
  /**
   * The feed is the third view in the selector. This process collects no
   * location, so the map option drops out and the toggle offers grid + feed —
   * which is also the case that used to hide the toggle entirely.
   */
  test('offers the feed in the view selector and mounts it when picked', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    const { slug, name } = await seedDecision({
      org,
      name: 'Feed View Selector',
      proposalCount: 2,
    });

    await authenticatedPage.goto(`/en/decisions/${slug}/current?filter=all`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    const feed = authenticatedPage.locator('[data-slot="proposal-feed"]');
    await expect(feed).toHaveCount(0);

    await authenticatedPage
      .getByRole('button', { name: 'Feed view' })
      .click({ timeout: 30_000 });

    await expect(feed).toBeVisible({ timeout: 30_000 });
    await expect(authenticatedPage).toHaveURL(/view=feed/);

    // The same browse card the grid and the map's list column render.
    await expect(
      feed.getByRole('link', { name: MOCK_PROPOSAL_TITLE }),
    ).toHaveCount(2);
  });

  /**
   * The feed's infinite-scroll sentinel sits inside the feed's own `<ul>`,
   * above its bottom centering padding — a sentinel placed after the list
   * would only trip once the reader had scrolled a third of a viewport past
   * the last card.
   */
  test('loads remaining proposals when scrolling the feed', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    const TOTAL_PROPOSALS = PAGE_LIMIT + 4;

    const { slug, name } = await seedDecision({
      org,
      name: 'Feed View Infinite Scroll',
      proposalCount: TOTAL_PROPOSALS,
    });

    await authenticatedPage.goto(
      `/en/decisions/${slug}/current?filter=all&view=feed`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    const proposalLink = authenticatedPage
      .locator('[data-slot="proposal-feed"]')
      .getByRole('link', { name: MOCK_PROPOSAL_TITLE });

    // First page lands at PAGE_LIMIT — not the full set — otherwise this would
    // pass without the feed being paginated at all.
    await expect(proposalLink.first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => proposalLink.count(), {
        timeout: 30_000,
        message: 'first page should load PAGE_LIMIT proposals',
      })
      .toBe(PAGE_LIMIT);

    // Pull the last loaded card into view on each tick, which brings the
    // in-list sentinel into the viewport and cascades through the rest.
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
            'after scrolling the feed, all proposals across pages should render',
        },
      )
      .toBe(TOTAL_PROPOSALS);
  });
});
