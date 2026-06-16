import { cn } from '../lib/utils';

export interface RequiredAsteriskProps {
  /** Additional classes applied to the asterisk. */
  className?: string;
}

/**
 * Decorative red asterisk marking a required field. Hidden from assistive
 * tech (`aria-hidden`) — the required semantics belong on the input itself
 * via `aria-required`, not on this visual marker.
 */
export const RequiredAsterisk = ({ className }: RequiredAsteriskProps) => {
  return (
    <span className={cn('text-functional-red', className)} aria-hidden="true">
      {' '}
      *
    </span>
  );
};
