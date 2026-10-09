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
 * Use this for any genuine instant — `createdAt`, `lastSignInAt`, a
 * submission time, and a phase deadline (enforced at its exact stored instant,
 * see `formatDeadline`). Render it with a format that carries the time, or a
 * date-only label can shift by a day between viewers.
 */
export function useDisplayTimeZone(): string {
  const { mounted } = useMount();

  return mounted
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : APP_TIME_ZONE;
}
