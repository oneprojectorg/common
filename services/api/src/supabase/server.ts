// This file is server-only to prevent the database from being imported in client components
// and to prevent the database URL from being exposed to the client.
import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { logger } from '@op/logging';
import { createServerClient } from '@op/supabase/lib';
import type {
  AuthError,
  CookieOptions,
  JwtPayload,
  UserResponse,
} from '@op/supabase/lib';
import type { Database } from '@op/supabase/types';
import 'server-only';
import type { TContext } from '../types';

const useUrl = OPURLConfig('APP');

const authUserCache = new WeakMap<TContext, Promise<UserResponse>>();
const authClaimsCache = new WeakMap<TContext, Promise<ClaimsResponse>>();

export type ClaimsResponse =
  | { data: { claims: JwtPayload }; error: null }
  | { data: null; error: AuthError }
  | { data: null; error: null };

/**
 * Authoritative GoTrue lookup. Prefer {@link getCachedAuthClaims} unless the
 * caller needs fields the JWT does not carry (e.g. `last_sign_in_at`).
 */
export function getCachedAuthUser(ctx: TContext): Promise<UserResponse> {
  let promise = authUserCache.get(ctx);
  if (!promise) {
    const supabase = createSBAdminClient(ctx);
    promise = supabase.auth.getUser();
    authUserCache.set(ctx, promise);
  }
  return promise;
}

/**
 * Local-verify auth lookup via `supabase.auth.getClaims()` — no GoTrue
 * round-trip for asymmetric JWTs. HS256 transparently falls back to
 * `auth.getUser()` inside the SDK. Cached per ctx to dedupe within a batch.
 */
export function getCachedAuthClaims(ctx: TContext): Promise<ClaimsResponse> {
  let promise = authClaimsCache.get(ctx);
  if (!promise) {
    const supabase = createSBAdminClient(ctx);
    promise = supabase.auth.getClaims().then((result) => {
      if (result.data) {
        return { data: { claims: result.data.claims }, error: null };
      }
      return { data: null, error: result.error };
    });
    authClaimsCache.set(ctx, promise);
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
          // A server-side caller context (RSC render, server action) has no
          // response to attach cookies to, so its `ctx.setCookie` throws by
          // design — see `serverClient.ts`. Supabase only calls this after
          // GoTrue has already rotated the session, so the new tokens are
          // lost and the browser keeps a refresh token GoTrue has consumed.
          //
          // No client option prevents that: `@supabase/ssr` already forces
          // `autoRefreshToken: false`, and what lands here is the on-demand
          // refresh `getSession()` runs once the access token is inside its
          // expiry margin. `apps/app/src/proxy.ts` normally absorbs it
          // against a writable response, but its matcher skips `/api/*` — so
          // this is a real gap, and it warns to stay countable. Don't log the
          // URL: routes that reach here include OAuth callbacks carrying
          // `?code=`.
          if (ctx.isServerSideCall) {
            logger.warn(
              'Dropped refreshed Supabase session: server-side caller context cannot write cookies',
              {
                cookieNames: cookiesToSet.map(({ name }) => name),
                requestId: ctx.requestId,
              },
            );

            return;
          }

          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              ctx.setCookie({ name, value, options });
            });
          } catch (error) {
            // Writable path: a failure here is unexpected, so it stays an
            // error.
            logger.error('Failed to set Supabase cookies', { error });
          }
        },
      },
    },
  );
};
