import { PostHog } from 'posthog-node';

export default function PostHogClient() {
  const posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    // Cap flag evaluation so a PostHog brownout can't stall a server render
    // that awaits a flag before painting.
    featureFlagsRequestTimeoutMs: 3000,
  });

  return posthogClient;
}
