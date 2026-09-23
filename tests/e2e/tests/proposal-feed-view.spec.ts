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

// Keep in sync with PROPOSALS_PAGE_LIMIT in ProposalsList.tsx.
const PAGE_LIMIT = 24;
const TOTAL_PROPOSALS = PAGE_LIMIT + 4;

/**
 * One journey rather than a test per assertion: seeding a decision is the
 * expensive part, and the second page only exists if the feed mounted in the
 * first place. Kept to a single seeded decision on purpose — this file runs
 * beside the other proposal specs, and a second one competes with them for
 * the local Supabase realtime connections they wait on.
 */
test.describe('Proposal Feed view', () => {
  /**
   * The feed is the third option in the view selector. This process collects
   * no location, so the map drops out and the selector offers grid + feed —
   * the case that used to render no selector at all.
   */
  test('is selectable in the view toggle and paginates like the other views', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    const process = await createDecisionProcess({
      createdByProfileId: org.organizationProfile.id,
      name: `Feed View ${Date.now()}`,
    });

    const { instance, slug, name } = await createDecisionInstance({
      processId: process.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: process.processSchema,
    });

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
    ).toBeVisible({ timeout: 30_000 });

    // Cards are on screen before the feed is asserted absent, so the absence
    // means the grid is showing rather than that nothing rendered at all.
    await expect(
      authenticatedPage
        .getByRole('link', { name: MOCK_PROPOSAL_TITLE })
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    const feed = authenticatedPage.locator('[data-slot="proposal-feed"]');
    await expect(feed).toHaveCount(0);

    const feedOption = authenticatedPage.getByRole('button', {
      name: 'Feed view',
    });
    await feedOption.click({ timeout: 30_000 });

    await expect(feed).toBeVisible({ timeout: 30_000 });
    await expect(authenticatedPage).toHaveURL(/view=feed/);

    // The same browse card the grid and the map's list column render.
    const proposalLink = feed.getByRole('link', { name: MOCK_PROPOSAL_TITLE });

    // First page lands at PAGE_LIMIT — not the full set — otherwise the scroll
    // below would pass without the feed being paginated at all.
    await expect(proposalLink.first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => proposalLink.count(), {
        timeout: 30_000,
        message: 'first page should load PAGE_LIMIT proposals',
      })
      .toBe(PAGE_LIMIT);

    // Pull the last loaded card into view on each tick, which brings the
    // sentinel (the feed's last list item, above its bottom centering padding)
    // into the viewport and cascades through the remaining pages.
    await expect
      .poll(
        async () => {
          await proposalLink.last().scrollIntoViewIfNeeded();
          return proposalLink.count();
        },
        {
          timeout: 30_000,
          message:
            'after scrolling the feed, all proposals across pages should render',
        },
      )
      .toBe(TOTAL_PROPOSALS);

    // This process has no map, so the floating MobileViewSwitch never renders
    // and the toggle is the only way out of the feed — it has to survive down
    // to a phone width or a shared `?view=feed` link strands the reader.
    await authenticatedPage.setViewportSize({ width: 375, height: 800 });
    await expect(feedOption).toBeVisible();

    // Back on the default view the param is dropped rather than pinned.
    await authenticatedPage.getByRole('button', { name: 'Grid view' }).click();
    await expect(feed).toHaveCount(0);
    await expect(authenticatedPage).not.toHaveURL(/view=/);
  });
});
