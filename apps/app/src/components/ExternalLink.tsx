import type { ComponentPropsWithoutRef } from 'react';

/**
 * Inline link that opens in a new tab. Stops click/pointer propagation so it
 * stays clickable when nested inside React Aria interactive components
 * (Checkbox, Switch, etc.), which would otherwise consume the press as a
 * toggle.
 */
export const ExternalLink = ({
  className = 'text-primary-teal underline',
  onClick,
  onPointerDown,
  ...rest
}: ComponentPropsWithoutRef<'a'>) => (
  <a
    target="_blank"
    rel="noreferrer"
    className={className}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    onPointerDown={(e) => {
      e.stopPropagation();
      onPointerDown?.(e);
    }}
    {...rest}
  />
);
