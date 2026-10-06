import {
  OPURLConfig,
  cookieOptionsDomain,
  isOnPreviewAppDomain,
} from '@op/core';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getCookies, setCookie } from '@tanstack/react-start/server';

import type { Database } from './types';

const useUrl = OPURLConfig('APP');

// Skip cookie domain on preview URLs (use host-only cookies)
const shouldSetCookieDomain =
  (useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW) &&
  !isOnPreviewAppDomain;

/**
 * A Supabase client bound to the current request's cookies. Server-only: it
 * reads and writes the request through TanStack Start's request context.
 */
export const createSBServerClient = async () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: shouldSetCookieDomain
        ? {
            domain: cookieOptionsDomain,
            sameSite: 'lax',
            secure: true,
          }
        : useUrl.IS_PREVIEW
          ? { sameSite: 'lax', secure: true }
          : {},
      cookies: {
        getAll: async () => {
          return Object.entries(getCookies()).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll: async (
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            setCookie(name, value, options);
          });
        },
      },
    },
  );
};

/**
 * Create a Supabase client with service role privileges.
 * This bypasses Row Level Security and should only be used in trusted server contexts
 * like background jobs, admin operations, or server-side migrations.
 *
 * WARNING: This client has full database access. Use with caution.
 */
export const createSBServiceClient = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE is not set. Service role client cannot be created.',
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
};
