import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SerializeOptions } from 'cookie';
import { cookies } from 'next/headers';

import type { Database } from './types';

const useUrl = OPURLConfig('APP');

export const createSBServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions:
        useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW
          ? {
              domain: cookieOptionsDomain,
              sameSite: 'lax',
              secure: true,
            }
          : {},
      cookies: {
        getAll: async () => {
          return cookieStore.getAll();
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
              const opts = options as SerializeOptions;

              cookieStore.set({ name, value, ...opts });
            });
          } catch (error) {
            console.error(error);
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
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
