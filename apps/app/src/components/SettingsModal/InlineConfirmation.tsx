'use client';

import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { LuCheck } from 'react-icons/lu';

export interface Confirmation {
  /** Changes on every new confirmation, so a repeat restarts the timer. */
  id: number;
  message: ReactNode;
  tone: 'success' | 'muted';
}

const VISIBLE_MS = 5000;
// Matches `duration-300` below.
const FADE_MS = 300;

/**
 * A short confirmation under a settings row ("Phone number added."). It stays
 * for five seconds, then fades and clears; with reduced motion it clears
 * without the fade. The live region stays mounted and empty between messages,
 * so screen readers announce each one as it arrives.
 */
export const InlineConfirmation = ({
  confirmation,
  onDismiss,
  className,
}: {
  confirmation: Confirmation | null;
  onDismiss: () => void;
  className?: string;
}) => {
  const [leavingId, setLeavingId] = useState<number | null>(null);
  const id = confirmation?.id;

  // The timer belongs to the confirmation, not to whichever `onDismiss`
  // closure rendered last.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (id === undefined) {
      return;
    }

    const fade = setTimeout(() => setLeavingId(id), VISIBLE_MS);
    const clear = setTimeout(
      () => onDismissRef.current(),
      VISIBLE_MS + FADE_MS,
    );

    return () => {
      clearTimeout(fade);
      clearTimeout(clear);
    };
  }, [id]);

  return (
    <p
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 text-sm transition-opacity duration-300 motion-reduce:transition-none',
        confirmation?.tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-success',
        confirmation && leavingId === confirmation.id && 'opacity-0',
        className,
      )}
    >
      {confirmation ? (
        <>
          <LuCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{confirmation.message}</span>
        </>
      ) : null}
    </p>
  );
};
