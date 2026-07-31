import { RECOMMENDATION_OPTION } from '@op/common/client';
import type { StatusDotIntent } from '@op/ui/StatusDot';

export function recommendationIntent(
  value: string | null | undefined,
): StatusDotIntent {
  if (!value) {
    return 'neutral';
  }
  if (value === RECOMMENDATION_OPTION.YES.value) {
    return 'success';
  }
  if (value === RECOMMENDATION_OPTION.NO.value) {
    return 'danger';
  }
  if (value === RECOMMENDATION_OPTION.MAYBE.value) {
    return 'warning';
  }
  return 'neutral';
}
