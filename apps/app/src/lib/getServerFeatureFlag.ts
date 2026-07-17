import PostHogClient from '@op/analytics/client';
import { getPosthogCookieName, parsePosthogDistinctId } from '@op/logging';
import { cookies } from 'next/headers';
import type { PostHog } from 'posthog-node';

// Reuse the shared server PostHog client rather than spinning up a bespoke one.
let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }
  if (!client) {
    client = PostHogClient();
  }
  return client;
}

/**
 * Read the PostHog distinct id the browser SDK persists, so server-side flag
 * evaluation targets the same identity the client does.
 */
async function getDistinctId(): Promise<string | null> {
  const cookieName = getPosthogCookieName();
  if (!cookieName) {
    return null;
  }
  const cookie = (await cookies()).get(cookieName);
  return parsePosthogDistinctId(cookie?.value) ?? null;
}

/**
 * Server-side feature flag read. Mirrors the client `useFeatureFlag` hook:
 * always on in development and e2e. Evaluating on the server lets a layout or
 * page branch before render, with no client flash.
 */
export async function getServerFeatureFlag(flag: string): Promise<boolean> {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_E2E === 'true'
  ) {
    return true;
  }

  const ph = getClient();
  const distinctId = await getDistinctId();
  if (!ph || !distinctId) {
    // No distinct id (logged-out / no prior posthog session) → flag off. This
    // is a team-only gate: the people meant to see the overview are logged in
    // and identified, so they resolve fine. When the overview is ready to be
    // the canonical public root, delete this flag entirely instead of building
    // anonymous-identity infra for it.
    return false;
  }

  // Fail closed: any network/timeout error resolves to off, so a PostHog
  // outage routes visitors to the canonical root rather than crashing render.
  try {
    return (await ph.isFeatureEnabled(flag, distinctId)) === true;
  } catch {
    return false;
  }
}
