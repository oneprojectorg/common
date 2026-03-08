import { users } from '@op/db/schema';
import { db, eq } from '@op/db/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Tests the channel-based query invalidation system end-to-end across two
 * separate browser sessions connected via Centrifugo WebSocket.
 *
 * The full pipeline under test:
 *   1. User A loads the landing page. The `listJoinRequests` query registers
 *      on the `profileJoinRequest:target:{orgProfileId}` channel via
 *      `ctx.registerQueryChannels`. The client-side tRPC link extracts the
 *      channel from the response and registers it in the `queryChannelRegistry`.
 *      `QueryInvalidationSubscriber` subscribes to the channel over WebSocket.
 *   2. User B (in a separate browser) visits User A's org profile and clicks
 *      "Request". The `createJoinRequest` mutation registers on the same
 *      channel via `ctx.registerMutationChannels`. The `withChannelMeta`
 *      middleware publishes a message to Centrifugo on that channel.
 *   3. Centrifugo broadcasts the message to User A's WebSocket subscription.
 *   4. User A's `QueryInvalidationSubscriber` receives the message and calls
 *      `queryClient.invalidateQueries` for all queries on matching channels.
 *   5. The `listJoinRequests` query refetches and User A's UI updates to show
 *      the new join request — without a page refresh.
 *
 * The primary assertion is a **network intercept**: we wait for User A's
 * browser to issue a new `profile.listJoinRequests` HTTP request after User B's
 * mutation. This is the direct proof that `queryClient.invalidateQueries` fired
 * as a result of the WebSocket message — no page refresh, no navigation, just
 * the realtime pipeline triggering a refetch.
 *
 * Requires Centrifugo to be running (see services/realtime/start-centrifugo.sh).
 */
test.describe('Query invalidation via realtime', () => {
  test('mutation on one client invalidates a query on another client via Centrifugo', async ({
    browser,
    org,
  }) => {
    const supabaseAdmin = createSupabaseAdminClient();

    // ── User A setup ──────────────────────────────────────────────────
    // User A is the org admin. Set their active profile to the org so
    // the landing page renders OrgNotifications (which includes
    // JoinProfileRequestsNotifications → listJoinRequests query).
    const userA = org.adminUser;

    await db
      .update(users)
      .set({ currentProfileId: org.organizationProfile.id })
      .where(eq(users.authUserId, userA.authUserId));

    // ── User B setup ──────────────────────────────────────────────────
    // User B is a member of a different org. Their active profile must
    // be their individual profile so the "Request" button appears on
    // User A's org profile page.
    const userBOrg = await createOrganization({
      testId: `qi-b-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    const userB = userBOrg.adminUser;

    const [userBRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, userB.authUserId));

    if (!userBRecord?.profileId) {
      throw new Error('User B has no individual profile');
    }

    await db
      .update(users)
      .set({ currentProfileId: userBRecord.profileId })
      .where(eq(users.authUserId, userB.authUserId));

    // ── User A: open landing page ─────────────────────────────────────
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await authenticateAsUser(pageA, {
      email: userA.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await pageA.goto('/en/');

    // Verify landing page loaded
    await expect(
      pageA.getByRole('heading', { level: 1, name: /Welcome back/ }),
    ).toBeVisible({ timeout: 15000 });

    // The listJoinRequests query has fired (0 results → component renders
    // nothing). The query is registered on the realtime channel and the
    // WebSocket subscription is active.
    await expect(pageA.getByText('Join requests')).not.toBeVisible();

    // ── Set up network intercept on User A BEFORE User B acts ─────────
    // This is the primary proof: we wait for User A's browser to issue a
    // new listJoinRequests request. This can only happen if the WebSocket
    // message triggered queryClient.invalidateQueries on that query.
    const refetchPromise = pageA.waitForResponse(
      (response) =>
        response.url().includes('profile.listJoinRequests') &&
        response.status() === 200,
      { timeout: 15000 },
    );

    // ── User B: open org profile and send join request ────────────────
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await authenticateAsUser(pageB, {
      email: userB.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    const orgSlug = org.organizationProfile.slug;
    await pageB.goto(`/en/profile/${orgSlug}`);

    // Wait for the profile page to load
    await expect(
      pageB.getByRole('heading', { name: org.organizationProfile.name }),
    ).toBeVisible({ timeout: 15000 });

    // Click "Request" to create a join request.
    // Server-side: withChannelMeta publishes to Centrifugo on the
    // profileJoinRequest:target channel.
    const requestButton = pageB.getByRole('button', { name: 'Request' });
    await expect(requestButton).toBeVisible({ timeout: 10000 });
    await requestButton.click();

    // ── Primary assertion: network-level proof of invalidation ────────
    // Wait for the refetch response on User A's page. This HTTP request
    // was triggered by:
    //   Centrifugo message → RealtimeManager → QueryInvalidationSubscriber
    //   → queryClient.invalidateQueries → listJoinRequests refetch
    // No navigation or refresh occurred — this is purely the realtime
    // invalidation pipeline.
    const refetchResponse = await refetchPromise;
    expect(refetchResponse.ok()).toBe(true);

    // ── Secondary assertion: UI confirms the data actually rendered ───
    await expect(pageA.getByText('Join requests')).toBeVisible({
      timeout: 5000,
    });
    await expect(
      pageA.getByText('wants to join your organization'),
    ).toBeVisible({ timeout: 5000 });

    // ── Cleanup ───────────────────────────────────────────────────────
    await contextA.close();
    await contextB.close();
  });
});
