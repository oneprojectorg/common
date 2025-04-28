import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type {
  AuthError,
  AuthOtpResponse,
  EmailOtpType,
  User,
  UserResponse,
} from '@supabase/supabase-js';

export {
  type AuthError,
  type AuthOtpResponse,
  type CookieOptions,
  createServerClient,
  type EmailOtpType,
  type User,
  type UserResponse,
};
