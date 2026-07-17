import posthog from 'posthog-js';

export type LogData = Record<string, unknown> & { error?: unknown };

// Client-side logger mirroring the server `@op/logging` API. Every level reports
// to PostHog and always writes to the console (dev and prod alike) — call this
// instead of `console.error` + `posthog.captureException`. `error`/`warn` become
// PostHog exceptions (the caught `error` is used as the captured value when it's
// an `Error`, otherwise a synthetic one carries the message and the raw value
// rides along); `info` is a plain PostHog event.
function report(level: 'error' | 'warning', message: string, data?: LogData) {
  const { error, ...context } = data ?? {};
  const captured = error instanceof Error ? error : new Error(message);

  posthog.captureException(captured, {
    level,
    message,
    ...(error !== undefined && !(error instanceof Error)
      ? { originalError: error }
      : {}),
    ...context,
  });
}

export const logger = {
  error(message: string, data?: LogData) {
    console.error(`[ERROR] ${message}`, data ?? '');
    report('error', message, data);
  },
  warn(message: string, data?: LogData) {
    console.warn(`[WARN] ${message}`, data ?? '');
    report('warning', message, data);
  },
  info(message: string, data?: Record<string, unknown>) {
    console.info(`[INFO] ${message}`, data ?? '');
    // Not sending info to PostHog yet — re-enable once we settle on the event
    // naming (see ONE-576 discussion). Console output still runs.
    // posthog.capture(message, data);
  },
};
