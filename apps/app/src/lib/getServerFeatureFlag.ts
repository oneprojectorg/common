import { cookies } from 'next/headers';
import { PostHog } from 'posthog-node';

// EU ingestion host — matches `posthogUIHost` (eu.posthog.com) in @op/core.
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return null;
  }
  if (!client) {
    client = new PostHog(key, { host: POSTHOG_HOST });
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
    return false;
  }

  return (await ph.isFeatureEnabled(flag, distinctId)) === true;
}
