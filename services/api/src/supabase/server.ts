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
  | { data: null; error: AuthError | null };

/**
 * Authoritative auth lookup. Performs an HTTPS round-trip to GoTrue
 * (`/auth/v1/user`) on every cache miss. Use only when the call site needs a
 * field that is not in the JWT payload (e.g. `confirmed_at`, `last_sign_in_at`)
 * or after a security-sensitive event where stale claims would be unsafe.
 *
 * For ordinary "who is the caller" lookups, prefer {@link getCachedAuthClaims}
 * — it verifies the JWT locally against JWKS and avoids the GoTrue hop.
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
 * Local-verify auth lookup. Decodes the caller's JWT and verifies it against
 * the project's JWKS via `supabase.auth.getClaims()` — no GoTrue round-trip
 * for asymmetric (RS256/ES256) JWTs. Symmetric (HS256) JWTs transparently fall
 * back to `auth.getUser()` inside the SDK, so the result shape is identical
 * either way.
 *
 * Cached per request context to dedupe across middlewares in the same tRPC
 * batch.
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
