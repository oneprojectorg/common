import { ProcessStatus } from '@op/api/encoders';
import type { StatusBadgeProps } from '@op/sense/StatusBadge';

import { hasFirstPhaseStarted } from '../hasFirstPhaseStarted';

export type ProcessAdminStatus = 'draft' | 'live' | 'completed' | 'cancelled';

export const STATUS_BADGE_VARIANT: Record<
  ProcessAdminStatus,
  NonNullable<StatusBadgeProps['variant']>
> = {
  draft: 'inactive',
  live: 'success',
  completed: 'inactive',
  cancelled: 'alert',
};

/** A missing or unknown status reads as the column default, `draft`. */
export function getProcessAdminStatus(
  status: string | null | undefined,
): ProcessAdminStatus {
  switch (status) {
    case ProcessStatus.PUBLISHED:
      return 'live';
    case ProcessStatus.COMPLETED:
      return 'completed';
    case ProcessStatus.CANCELLED:
      return 'cancelled';
    default:
      return 'draft';
  }
}

/**
 * Whether the process is open to participants, so the admin page may mark the
 * current phase and link to the proposals. A draft is never open, whatever its
 * dates say, and a process with no phases has not started. (The public page
 * shows its CTAs by default when the dates are missing; the admin page does
 * not.) Pass the server's render time as `now` on the client, so the server
 * and hydrated output agree.
 */
export function isProcessOpen({
  status,
  phases,
  now,
}: {
  status: string | null | undefined;
  phases: { startDate?: string }[] | undefined;
  now: Date;
}): boolean {
  if (getProcessAdminStatus(status) === 'draft') {
    return false;
  }

  return (phases?.length ?? 0) > 0 && hasFirstPhaseStarted(phases, now);
}
