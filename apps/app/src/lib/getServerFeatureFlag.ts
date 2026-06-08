import PostHogClient from '@op/analytics/client';
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
 * evaluation targets the same identity the client does. posthog-js stores it
 * as JSON under `ph_<project_key>_posthog`.
 */
async function getDistinctId(): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return null;
  }
  const cookie = (await cookies()).get(`ph_${key}_posthog`);
  if (!cookie) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(cookie.value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'distinct_id' in parsed &&
      typeof parsed.distinct_id === 'string'
    ) {
      return parsed.distinct_id;
    }
    return null;
  } catch {
    return null;
  }
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
    // TODO(overview-canonical): cookie-less visitors (new/anon, private mode,
    // crawlers) have no distinct id, so the flag is forced off. Fine while the
    // overview lives behind the flag at /overview. Before it becomes the
    // canonical public root, stand up PostHog's recommended Next.js setup:
    // middleware that ensures a distinct-id cookie and bootstraps flag values
    // (or @posthog/next). That durably fixes anon identity, the per-render
    // /decide network call, and server/client flag flicker in one move.
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
