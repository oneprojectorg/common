import {
  createDecisionInstance,
  getSeededTemplate,
  makeDecisionPublic,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Supabase Realtime opens a websocket at `/realtime/v1/websocket`. Matching the
 * path (rather than the host) keeps this robust across local/preview/prod URLs.
 */
const isRealtimeSocket = (url: string): boolean =>
  url.includes('/realtime/v1/');

type SeedOrg = {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string };
};

async function seedDecision(org: SeedOrg) {
  const template = await getSeededTemplate();
  return createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
  });
}

test.describe('realtime channel gating', () => {
  test('a signed-in user opens a realtime websocket on a decision page', async ({
    authenticatedPage,
    org,
  }) => {
    const { slug } = await seedDecision(org);

    // Arm the listener before navigating so we don't miss the connection.
    const socket = authenticatedPage.waitForEvent('websocket', {
      predicate: (ws) => isRealtimeSocket(ws.url()),
      timeout: 15_000,
    });

    await authenticatedPage.goto(`/en/decisions/${slug}`, {
      waitUntil: 'domcontentloaded',
    });

    // getInstance registers the decision channel; the signed-in subscriber
    // subscribes to it over the realtime socket.
    await expect(socket).resolves.toBeTruthy();
  });

  test('a public visitor opens no realtime websocket', async ({
    browser,
    org,
  }) => {
    const { slug, profileId } = await seedDecision(org);

    // Open the decision to no-session visitors so the page actually renders
    // (and would otherwise register channels). This isolates the session gate
    // as the only reason no socket opens.
    await makeDecisionPublic({ profileId });

    // A fresh context with no worker session = a true no-session visitor
    // (the shared fixture authenticates every page via storageState).
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    let realtimeOpened = false;
    page.on('websocket', (ws) => {
      if (isRealtimeSocket(ws.url())) {
        realtimeOpened = true;
      }
    });

    try {
      await page.goto(`/en/decisions/${slug}`, { waitUntil: 'networkidle' });
      // Guard against a vacuous pass: the visitor must actually land on the
      // (public) decision page, not get bounced to login — otherwise "no
      // socket" would just mean "no page", not "gated".
      expect(page.url()).toContain(`/decisions/${slug}`);
      // Give the client a beat to (not) open the socket after hydration.
      await page.waitForTimeout(3000);
      expect(realtimeOpened).toBe(false);
    } finally {
      await context.close();
    }
  });
});
