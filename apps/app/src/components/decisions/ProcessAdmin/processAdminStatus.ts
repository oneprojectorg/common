import { ProcessStatus } from '@op/api/encoders';
import type { StatusBadgeProps } from '@op/sense/StatusBadge';

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
