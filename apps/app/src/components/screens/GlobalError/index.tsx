import { posthogUIHost } from '@op/core';
import posthog from 'posthog-js';
import { useEffect } from 'react';

import { stampExceptionWithTraceContext } from '@/lib/otelErrorTracking';

/**
 * The last-resort error screen, for a failure outside every localized route —
 * possibly in the providers themselves — so PostHogProvider, the intl
 * provider, Tailwind, and @op/sense may all be unavailable. Hardcoded strings,
 * inline styles, and the manual posthog.init are intentional.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY && !posthog.__loaded) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: '/stats',
        ui_host: posthogUIHost,
        capture_exceptions: true,
        before_send: stampExceptionWithTraceContext,
        // No host gets tracing headers — injecting them breaks CORS requests.
        tracing_headers: [],
      });
    }
  }, []);

  useEffect(() => {
    posthog.captureException(error, {
      error_digest: error.digest,
    });
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        gap: '16px',
      }}
    >
      <h2>Something went wrong</h2>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
