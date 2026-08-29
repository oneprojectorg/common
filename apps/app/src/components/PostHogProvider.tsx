'use client';

import { POSTHOG_SESSION_ID_COOKIE, posthogUIHost } from '@op/core';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';

import { dropBenignBrowserErrors } from '../lib/benignBrowserErrors';
import { stampExceptionWithTraceContext } from '../lib/otelErrorTracking';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: '/stats',
      ui_host: posthogUIHost,
      capture_pageview: false, // We capture pageviews manually
      capture_pageleave: true,
      capture_exceptions: true,
      // Capture Core Web Vitals (LCP/CLS/INP/FCP). Off by default in posthog-js;
      // the web-vitals collection lib ships transitively with posthog-js.
      capture_performance: { web_vitals: true },
      // Drop benign browser/extension noise, then stamp real exceptions with
      // OTel trace/span ids so they join to their traces. Runs in order; the
      // filter returning null drops the event before it is stamped or sent.
      before_send: [dropBenignBrowserErrors, stampExceptionWithTraceContext],
      // Tracing headers set to `false` because it breaks CORS requests
      __add_tracing_headers: false,
    });

    // Mirror the session id into a cookie so server-side renders — which never
    // receive the `x-posthog-session-id` request header the tRPC HTTP link
    // adds — can still stamp `sessionId` onto their logs. `onSessionId` fires
    // immediately with the current id and again whenever the session rotates,
    // and returns the unsubscribe handler for cleanup.
    return posthog.onSessionId((sessionId) => {
      if (!sessionId) {
        return;
      }
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${POSTHOG_SESSION_ID_COOKIE}=${encodeURIComponent(sessionId)}; path=/; max-age=86400; SameSite=Lax${secure}`;
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PHProvider>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname;
      const search = searchParams.toString();

      if (search) {
        url += `?${search}`;
      }

      posthogClient.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}
