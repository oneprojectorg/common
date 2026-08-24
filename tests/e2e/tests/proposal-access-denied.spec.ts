import {
  createDecisionInstance,
  createProposal,
  createUser,
  getSeededTemplate,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Both proposal routes fetch through `decision.getProposal`, which 403s for
 * anyone outside the decision. That rejection used to reach the client tree,
 * where it escaped the SSR render as an unhandled one (PostHog: 26 such
 * renders on the detail route and 26 on /edit in one week). These pin the
 * state each caller should land on now that the server settles it.
 */
test.describe('Proposal routes — caller without access', () => {
  const buildScenario = async (org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  }) => {
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
      proposalData: {
        title: 'Proposal only members can open',
        collaborationDocId: 'test-proposal-view-doc',
      },
    });

    return {
      detailUrl: `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      editUrl: `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
    };
  };

  test('a signed-in non-member gets the no-access page on both routes', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const { detailUrl, editUrl } = await buildScenario(org);

    const email = `proposal-nonmember-${testInfo.workerIndex}-${Date.now()}@example.com`;
    const nonMember = await createUser({ supabaseAdmin, email });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    for (const url of [detailUrl, editUrl]) {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Server-rendered, not painted after hydration — the server settles
      // access before the client tree mounts.
      expect(await response!.text()).toContain(
        "You don't have access to this page",
      );

      // The decision-scoped forbidden.tsx, not the generic error page.
      await expect(
        page.getByRole('heading', {
          name: "You don't have access to this page",
        }),
      ).toBeVisible({ timeout: 36_000 });
    }

    await ctx.close();
    await supabaseAdmin.auth.admin.deleteUser(nonMember.id);
  });

  test('a signed-out visitor is offered sign-in, not an error', async ({
    browser,
    org,
  }) => {
    const { detailUrl } = await buildScenario(org);

    // No stored session: this is the shared-link case that made up most of the
    // logged failures.
    const ctx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await ctx.newPage();

    await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Sign in to view this page' }),
    ).toBeVisible({ timeout: 36_000 });

    // The sign-in link must carry them back to the proposal they opened, and
    // must not pick up a locale prefix — /login lives outside the [locale] tree.
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(detailUrl)}`,
    );

    await ctx.close();
  });
});
