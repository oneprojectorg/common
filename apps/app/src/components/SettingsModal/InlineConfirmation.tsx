'use client';

import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { LuCheck, LuTriangleAlert } from 'react-icons/lu';

export interface Confirmation {
  // bumped on every new confirmation so a repeat restarts the timer
  id: number;
  message: ReactNode;
  tone: 'success' | 'muted' | 'error';
}

const VISIBLE_MS = 5000;
// matches duration-300 below
const FADE_MS = 300;

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

  // the timer belongs to the confirmation, not to the last-rendered onDismiss closure
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
    // stays mounted while empty so screen readers announce each message
    <p
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 text-sm transition-opacity duration-300 motion-reduce:transition-none',
        confirmation?.tone === 'muted' && 'text-muted-foreground',
        confirmation?.tone === 'success' && 'text-success',
        confirmation?.tone === 'error' && 'text-destructive',
        confirmation && leavingId === confirmation.id && 'opacity-0',
        className,
      )}
    >
      {confirmation ? (
        <>
          {confirmation.tone === 'error' ? (
            <LuTriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <LuCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{confirmation.message}</span>
        </>
      ) : null}
    </p>
  );
};
