import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { cookieOptionsDomain, OPURLConfig } from '@op/core';

import type { Database } from './types';
import type { CookieOptions } from '@supabase/ssr';
import type { SerializeOptions } from 'cookie';

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

              cookieStore.set({ name, value, ...(opts) });
            });
          }
          catch (error) {
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
