import { createDecisionInstance, getSeededTemplate } from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Reproduces the "new proposal doesn't show until ~30s later" bug: the list is
 * a `useSuspenseInfiniteQuery` with `staleTime: 30s`, so after creating a
 * proposal it must be refreshed by channel invalidation, not served stale.
 * The return navigation MUST stay client-side — a hard reload would refetch
 * from the server and mask the bug.
 */
test.describe('Proposal Listing — update after create', () => {
  test('a newly created proposal appears without waiting for staleTime', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // View the (empty) listing — registers the client-side listProposals query.
    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/current?filter=all`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(authenticatedPage.getByText('No proposals yet')).toBeVisible({
      timeout: 30_000,
    });

    // Create via the CTA (client-side nav to the editor, fires createProposal).
    const createProposalResponse = authenticatedPage.waitForResponse(
      (resp) => resp.url().includes('decision.createProposal') && resp.ok(),
      { timeout: 30_000 },
    );
    await authenticatedPage
      .getByRole('button', { name: 'Start a proposal' })
      .click();
    await createProposalResponse;
    await authenticatedPage.waitForURL(
      new RegExp(`/decisions/${instance.slug}/proposal/[^/]+/edit`),
      { timeout: 15_000 },
    );

    // Return via client-side history — NOT a reload (which would mask the bug).
    await authenticatedPage.goBack({ waitUntil: 'commit' });
    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // The new draft must appear well within the 30s staleTime.
    await expect(authenticatedPage.getByText('No proposals yet')).toBeHidden({
      timeout: 10_000,
    });
    await expect(
      authenticatedPage.locator('a[href*="/proposal/"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
