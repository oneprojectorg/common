import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type {
  AuthError,
  AuthOtpResponse,
  EmailOtpType,
  JwtPayload,
  User,
  UserResponse,
} from '@supabase/supabase-js';

/**
 * Narrower auth identity returned by the local-verify (JWT claims) path: only
 * the fields a verified JWT actually carries. Server-side timestamps
 * (`created_at`, `confirmed_at`, `email_confirmed_at`, `last_sign_in_at`) are
 * intentionally absent. Service-layer functions that don't read those should
 * accept this type rather than the full {@link User}, so they can be called
 * from both authoritative and claims-based procedure tiers.
 */
export type ClaimsUser = Pick<
  User,
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
  type User,
  type UserResponse,
};
