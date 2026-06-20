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
