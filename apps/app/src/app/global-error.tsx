'use client';

import { posthogUIHost } from '@op/core';
import posthog from 'posthog-js';
import { useEffect } from 'react';

import { capturePostHogException } from '@/lib/capturePostHogException';

// This component replaces the root layout on catastrophic errors, so
// PostHogProvider, next-intl, Tailwind, and @op/ui are all unavailable.
// Hardcoded strings, inline styles, and the manual posthog.init are intentional.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: '/stats',
        ui_host: posthogUIHost,
        capture_exceptions: true,
        __add_tracing_headers: true,
      });
    }

    capturePostHogException(error, 'global-error', {
      $exception_digest: error.digest,
    });
  }, [error]);

  return (
    <html>
      <body>
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
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
