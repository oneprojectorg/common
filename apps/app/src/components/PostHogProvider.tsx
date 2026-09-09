'use client';

import { POSTHOG_SESSION_ID_COOKIE, posthogUIHost } from '@op/core';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { stampExceptionWithTraceContext } from '../lib/otelErrorTracking';

/** `undefined` until `posthog.init()` has run — nothing is known before that. */
type ConsentStatus = 'granted' | 'denied' | 'pending' | undefined;

interface TrackingConsent {
  status: ConsentStatus;
  /** Full tracking: cookies, local storage, and an identified person. */
  accept: () => void;
  /** Keeps capturing events, cookielessly and without an identity. */
  reject: () => void;
}

const TrackingConsentContext = createContext<TrackingConsent | undefined>(
  undefined,
);

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>();

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
      // Stamp exceptions with OTel trace/span ids so they join to their traces
      before_send: stampExceptionWithTraceContext,
      // No host gets tracing headers — injecting them breaks CORS requests.
      // (`__add_tracing_headers: false` until posthog-js turned this into an
      // allowlist of hostnames; the empty list is the same "never" it meant.)
      tracing_headers: [],
      // Cookieless until the visitor accepts. These two settings work as a
      // pair: `opt_out_capturing_by_default` makes a visitor who hasn't
      // answered the consent toast count as opted out, and in `on_reject`
      // mode an opted-out visitor is still captured — just with no cookies,
      // no local storage and no persistent identity, with PostHog hashing
      // visitors server-side instead. `opt_in_capturing()` is the only thing
      // that switches us to cookies. posthog-js stores the explicit choice
      // itself (`opt_out_capturing_persistence_type`, local storage by
      // default), so the answer survives a reload.
      cookieless_mode: 'on_reject',
      opt_out_capturing_by_default: true,
    });

    setStatus(posthog.get_explicit_consent_status());
  }, []);

  useEffect(() => {
    // The mirrored cookie is a cookie like any other: only write it once the
    // visitor has accepted. Cookieless visitors have no client-side session
    // id to mirror anyway — ingestion assigns theirs server-side.
    if (status !== 'granted') {
      return;
    }

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
  }, [status]);

  const accept = useCallback(() => {
    posthog.opt_in_capturing();
    setStatus(posthog.get_explicit_consent_status());
  }, []);

  const reject = useCallback(() => {
    posthog.opt_out_capturing();
    setStatus(posthog.get_explicit_consent_status());
  }, []);

  const consent = useMemo(
    () => ({ status, accept, reject }),
    [status, accept, reject],
  );

  return (
    <PHProvider client={posthog}>
      <TrackingConsentContext.Provider value={consent}>
        <SuspendedPostHogPageView />
        {children}
      </TrackingConsentContext.Provider>
    </PHProvider>
  );
}

/**
 * The visitor's analytics consent. `status` is `undefined` until
 * `PostHogProvider`'s init effect has run — child effects fire before their
 * parent's, so the answer can't be read straight off `posthog` at mount.
 */
export function useTrackingConsent() {
  const consent = useContext(TrackingConsentContext);

  if (!consent) {
    throw new Error('useTrackingConsent must be used within a PostHogProvider');
  }

  return consent;
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
