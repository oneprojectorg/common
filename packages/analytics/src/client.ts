import { PostHog } from 'posthog-node';

let client: PostHog | undefined;

export default function PostHogClient(): PostHog {
  if (!client) {
    const instance = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: 'https://eu.i.posthog.com',
      // Batch events so a brownout can't add a synchronous HTTPS POST to
      // every authenticated request. Per-call helpers stopped awaiting
      // shutdown(); the batch flushes on flushAt/flushInterval and on exit.
      flushAt: 20,
      flushInterval: 5000,
      // Cap flag evaluation so a PostHog brownout can't stall a server render
      // that awaits a flag before painting.
      featureFlagsRequestTimeoutMs: 3000,
    });
    process.once('beforeExit', () => {
      void instance.shutdown();
    });
    client = instance;
  }

  return client;
}
