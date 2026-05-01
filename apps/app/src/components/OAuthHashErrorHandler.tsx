'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Supabase OAuth surfaces provider-side errors (e.g. user cancelled the
 * Google consent screen) by redirecting to the configured Site URL with the
 * error in the URL fragment, not the query string. The browser never sends
 * the fragment to the server, so the callback route can't see it.
 * This client effect parses the fragment and routes the user to /login with
 * a typed error code and the provider's description so the LoginPanel can
 * render a real error UI.
 */
export const OAuthHashErrorHandler = () => {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const hash = window.location.hash;
    if (!hash) {
      return;
    }
    const params = new URLSearchParams(
      hash.startsWith('#') ? hash.slice(1) : hash,
    );
    // `sb` is Supabase's marker on OAuth-error redirects. Gating on it avoids
    // colliding with regular in-page anchor links that happen to contain
    // "error".
    if (!params.has('sb')) {
      return;
    }
    const providerError = params.get('error');
    if (!providerError) {
      return;
    }
    const providerErrorCode = params.get('error_code');
    const providerErrorDescription = params.get('error_description');

    console.error('[oauth] provider returned error', {
      error: providerError,
      error_code: providerErrorCode,
      error_description: providerErrorDescription,
    });

    const target = new URL('/login', window.location.origin);
    target.searchParams.set(
      'error',
      providerError === 'access_denied' ? 'oauth_cancelled' : 'oauth_failed',
    );
    if (providerErrorDescription) {
      target.searchParams.set('error_description', providerErrorDescription);
    }
    router.replace(`${target.pathname}${target.search}`);
  }, [router]);

  return null;
};
