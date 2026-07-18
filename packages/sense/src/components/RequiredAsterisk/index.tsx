import { cn } from '../../lib/utils';

interface RequiredAsteriskProps {
  className?: string;
}

/**
 * Decorative asterisk marking a required field. Hidden from assistive tech
 * (`aria-hidden`) — the required semantics belong on the input itself via
 * `required`/`aria-required`, not on this visual marker.
 */
function RequiredAsterisk({ className }: RequiredAsteriskProps) {
  return (
    <span className={cn('text-destructive', className)} aria-hidden="true">
      {' '}
      *
    </span>
  );
}

export { RequiredAsterisk };
