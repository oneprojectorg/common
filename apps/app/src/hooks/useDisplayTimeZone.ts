'use client';

import { useMount } from '@op/hooks';

import { APP_TIME_ZONE } from '@/lib/i18n/config';

/**
 * The time zone a timestamp should be rendered in right now.
 *
 * Returns `APP_TIME_ZONE` on the server and on the first client render, then
 * the viewer's own zone once mounted. Both passes of hydration therefore agree
 * — the swap happens in the mount re-render, which React is free to differ on
 * — and the value the viewer ends up reading is in their real zone.
 *
 * Use this for a genuine instant: something that happened at one moment in
 * time, where "when was that for me" is the question the reader is asking —
 * `createdAt`, `lastSignInAt`, a submission time.
 *
 * Do NOT use it for a calendar date the organizers chose, such as a phase
 * start or end. Those are stored as the instant of midnight in whichever zone
 * the admin happened to be in when they picked the day, so re-reading them in
 * the viewer's zone shifts the deadline by a day rather than localizing it.
 */
export function useDisplayTimeZone(): string {
  const { mounted } = useMount();

  return mounted
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : APP_TIME_ZONE;
}
