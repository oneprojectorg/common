import { Alert, AlertDescription } from '@op/sense/Alert';
import type { ComponentProps } from 'react';
import { LuLock } from 'react-icons/lu';

/** Info alert with a lock icon; give it an `id` for the locked controls' `aria-describedby`. */
export function LockNote({ children, ...props }: ComponentProps<'div'>) {
  return (
    // `role="note"`: shown on load, so the default `alert` role would
    // interrupt the screen reader with it.
    <Alert variant="info" role="note" {...props}>
      <LuLock aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
