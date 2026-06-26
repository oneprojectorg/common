import { cn } from '@op/ui/utils';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Anchor that opens in a new tab with a safe `rel`. Use anywhere we link out
 * to a policy / docs / external URL. `stopOnPress` blocks the click/pointer
 * from bubbling — needed when the link is rendered inside a React Aria
 * pressable (e.g. Checkbox) that would otherwise toggle on click.
 */
export const ExternalLink = ({
  href,
  children,
  className,
  stopOnPress = false,
  onClick,
  onPointerDown,
  ...rest
}: {
  href: string;
  children: ReactNode;
  stopOnPress?: boolean;
} & Omit<ComponentProps<'a'>, 'href' | 'target' | 'rel' | 'children'>) => (
  <a
    {...rest}
    href={href}
    target="_blank"
    rel="noreferrer"
    className={cn('text-primary-teal underline', className)}
    onClick={(e) => {
      if (stopOnPress) {
        e.stopPropagation();
      }
      onClick?.(e);
    }}
    onPointerDown={(e) => {
      if (stopOnPress) {
        e.stopPropagation();
      }
      onPointerDown?.(e);
    }}
  >
    {children}
  </a>
);
