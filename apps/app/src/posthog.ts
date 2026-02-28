import { PostHog } from 'posthog-node';

export default function PostHogClient(): PostHog | null {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!posthogKey) {
    return null;
  }

  const posthogClient = new PostHog(posthogKey, {
    host: 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogClient;
}
