'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';

/**
 * True below the `sm` breakpoint (640px) — the app's phone/desktop split, and
 * the same boundary as the `sm:` Tailwind variants a component pairs it with.
 *
 * Defaults to `false` rather than `undefined`, so a server render and the
 * first client paint agree on the desktop layout instead of flashing the
 * mobile one.
 *
 * NOT the same as `useIsMobile` inside `@op/sense`: that one is the sidebar's
 * own 768px (`md`) cutoff and is private to that component. Don't reach for it
 * here, and don't assume the two agree.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
}
