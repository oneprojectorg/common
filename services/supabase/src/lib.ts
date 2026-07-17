import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type {
  AuthError,
  AuthOtpResponse,
  EmailOtpType,
  JwtPayload,
  Provider,
  User as SupabaseAuthUser,
  UserResponse,
} from '@supabase/supabase-js';

/**
 * Auth identity carried by a verified Supabase JWT. Server-side fields
 * (`confirmed_at`, `last_sign_in_at`, `identities`, ...) are intentionally
 * absent; the few sites that need them reach for `UserResponse` directly.
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
  type Provider,
  type UserResponse,
};
