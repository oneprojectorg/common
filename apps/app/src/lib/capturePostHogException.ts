import posthog from 'posthog-js';

/** Captures an exception via PostHog. Safe to call before PostHogProvider mounts. */
export function capturePostHogException(
  error: unknown,
  extra?: Record<string, unknown>,
) {
  posthog.captureException(error, extra);
}
