// This file is server-only to prevent the database from being imported in client components
// and to prevent the database URL from being exposed to the client.
import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { logger } from '@op/logging';
import { createServerClient } from '@op/supabase/lib';
import type { CookieOptions, UserResponse } from '@op/supabase/lib';
import type { Database } from '@op/supabase/types';
import 'server-only';
import type { TContext } from '../types';

const useUrl = OPURLConfig('APP');

// Pin the Supabase SSR cookie name to the browser-facing hostname, but ONLY
// when the server reaches Supabase at a different URL than the browser (i.e.
// SUPABASE_URL is set and differs from NEXT_PUBLIC_SUPABASE_URL — this is the
// docker-dev cross-container case, where the browser uses localhost:3121 and
// the server uses dind:54321). In prod/staging both vars resolve to the same
// host so this returns undefined and Supabase's default naming kicks in.
const supabaseAuthCookieStorageKey = () => {
  const browserUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverUrl = process.env.SUPABASE_URL;
  if (!browserUrl || !serverUrl || browserUrl === serverUrl) return undefined;
  try {
    return `sb-${new URL(browserUrl).hostname}-auth-token`;
  } catch {
    return undefined;
  }
};

const authUserCache = new WeakMap<TContext, Promise<UserResponse>>();

export function getCachedAuthUser(ctx: TContext): Promise<UserResponse> {
  let promise = authUserCache.get(ctx);
  if (!promise) {
    const supabase = createSBAdminClient(ctx);
    promise = supabase.auth.getUser();
    authUserCache.set(ctx, promise);
  }
  return promise;
}

export const createSBAdminClient = (ctx: TContext) => {
  return createServerClient<Database>(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      // See supabaseAuthCookieStorageKey(): only populated when the server
      // reaches Supabase at a different host than the browser (docker-dev).
      // Undefined in prod, so Supabase keeps its default cookie naming.
      ...(supabaseAuthCookieStorageKey()
        ? { auth: { storageKey: supabaseAuthCookieStorageKey() } }
        : {}),
      cookieOptions: useUrl.IS_PRODUCTION
        ? {
            domain: cookieOptionsDomain,
            sameSite: 'lax',
            secure: true,
          }
        : {},
      cookies: {
        getAll: async () => {
          return Object.entries(ctx.getCookies() || {})
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => ({ name, value: value as string }));
        },
        setAll: async (
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              ctx.setCookie({ name, value, options });
            });
          } catch (error) {
            logger.error('Failed to set Supabase cookies', { error });
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};
