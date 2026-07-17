'use client';

import { posthogUIHost } from '@op/core';
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
