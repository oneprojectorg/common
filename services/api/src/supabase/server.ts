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

const authUserCache = new WeakMap<TContext, Promise<UserResponse>>();

export function getCachedAuthUser(ctx: TContext): Promise<UserResponse> {
  let promise = authUserCache.get(ctx);
  if (!promise) {
    const supabase = createSBAdminClient(ctx);
    promise = supabase.auth.getUser().then((result) => {
      if (result.error) {
        const cookies = ctx.getCookies();
        const cookieNames = Object.keys(cookies || {});
        const hasSbCookies = cookieNames.some((k) => k.startsWith('sb-'));
        const sbCookieNames = cookieNames.filter((k) => k.startsWith('sb-'));
        const authErrorDetails = {
          errorMessage: result.error.message,
          errorStatus: (result.error as any).status,
          errorCode: (result.error as any).code,
          hasSbCookies,
          sbCookieNames,
          totalCookieCount: cookieNames.length,
          isServerSideCall: ctx.isServerSideCall,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
          requestUrl: ctx.reqUrl,
        };
        console.error('supabase.auth.getUser() failed', authErrorDetails);
        logger.error('supabase.auth.getUser() failed', authErrorDetails);
      }
      return result;
    });
    authUserCache.set(ctx, promise);
  }
  return promise;
}

export const createSBAdminClient = (ctx: TContext) => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
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
