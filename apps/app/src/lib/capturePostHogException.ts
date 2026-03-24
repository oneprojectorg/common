import posthog from 'posthog-js';

/**
 * Captures a $exception event via PostHog. Safe to call whether or not
 * PostHogProvider has initialized — posthog-js queues events internally.
 */
export function capturePostHogException(
  error: Error,
  source: string,
  extra?: Record<string, unknown>,
) {
  posthog.capture('$exception', {
    $exception_message: error.message,
    $exception_type: error.name,
    $exception_stack_trace_raw: error.stack,
    $exception_source: source,
    ...extra,
  });
}
