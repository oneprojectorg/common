import { cn } from '@op/sense/lib/utils';
import type { ComponentProps } from 'react';
import { LuLock } from 'react-icons/lu';

/** Muted lock-icon note; give it an `id` for the locked controls' `aria-describedby`. */
export function LockNote({
  className,
  children,
  ...props
}: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm text-muted-foreground',
        className,
      )}
      {...props}
    >
      <LuLock className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
