import {
  OPURLConfig,
  cookieOptionsDomain,
  isOnPreviewAppDomain,
} from '@op/core';
import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './types';

const useUrl = OPURLConfig('APP');

// Skip cookie domain on .vercel.app preview URLs (use host-only cookies)
const shouldSetCookieDomain =
  (useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW) &&
  !isOnPreviewAppDomain;

export const createSBBrowserClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: shouldSetCookieDomain
        ? {
            domain: cookieOptionsDomain,
            sameSite: 'lax',
            secure: true,
          }
        : useUrl.IS_PREVIEW
          ? { sameSite: 'lax', secure: true }
          : {},
    },
  );
};
