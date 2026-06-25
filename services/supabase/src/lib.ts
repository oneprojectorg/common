import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type {
  AuthError,
  AuthOtpResponse,
  EmailOtpType,
  JwtPayload,
  User as SupabaseAuthUser,
  UserResponse,
} from '@supabase/supabase-js';

/**
 * Our auth identity: only the fields a verified Supabase JWT actually carries.
 * Server-side timestamps (`created_at`, `confirmed_at`, `email_confirmed_at`,
 * `last_sign_in_at`) and other authoritative-only fields (`identities`,
 * `factors`, ...) are intentionally absent — they're not in the JWT and the
 * vast majority of code paths shouldn't depend on them. The two production
 * sites that historically need those wider fields (`verifyAuthentication`,
 * `getPlatformStats`) reach for the SDK's `UserResponse` / direct
 * `@supabase/supabase-js` import instead.
 */
export type User = Pick<
  SupabaseAuthUser,
  | 'id'
  | 'aud'
  | 'role'
  | 'email'
  | 'phone'
  | 'app_metadata'
  | 'user_metadata'
  | 'is_anonymous'
>;

export {
  type AuthError,
  type AuthOtpResponse,
  type CookieOptions,
  createServerClient,
  type EmailOtpType,
  type JwtPayload,
  type UserResponse,
};
