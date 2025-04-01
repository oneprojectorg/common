
import { createBrowserClient } from '@supabase/ssr';

import { cookieOptionsDomain, OPURLConfig } from '@op/core';

import type { Database } from './types';

const useUrl = OPURLConfig('APP');

export const createSBBrowserClient = () => {
  return createBrowserClient<Database>(
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
    },
  );
};
