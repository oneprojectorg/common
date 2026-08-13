'use client';

import { useState } from 'react';

import { cn } from '../../lib/utils';

/**
 * A number that swaps as it changes — the old value slides out as the new one
 * slides in, both travelling the same way (upward when the count grows).
 *
 * The two sit in one grid cell so they overlap without absolute positioning,
 * and the outgoing one is removed once its animation ends, so the box goes back
 * to the width of a single number. No JS animation loop and no measurement: the
 * travel is in `em`, so it tracks whatever text size it inherits.
 *
 * Silent on first paint — a grid of cards shouldn't tick as it loads. Under
 * `motion-reduce` the outgoing number is `hidden` rather than merely
 * un-animated: it would otherwise sit on top of the new one, and with no
 * animation there'd be no `animationend` to clear it.
 */
export function AnimatedCount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  // One piece of state so the value and the number it replaced can't disagree.
  const [seen, setSeen] = useState<{ value: number; outgoing: number | null }>({
    value,
    outgoing: null,
  });

  // `Object.is`, not `!==`: `NaN !== NaN`, so a non-finite count would set
  // state on every render until React gives up with "too many re-renders".
  if (!Object.is(seen.value, value)) {
    // A render-phase update: React re-runs this component with the new state
    // before committing, so the stale `seen` below never reaches the DOM.
    setSeen({ value, outgoing: seen.value });
  }

  const { outgoing } = seen;
  const grew = outgoing !== null && value > outgoing;

  return (
    <span
      className={cn(
        'inline-grid tabular-nums',
        // Sets `--count-travel`; both halves read it, so they can't disagree
        // about which way the number moved.
        grew ? 'count-rising' : 'count-falling',
        className,
      )}
    >
      {outgoing !== null && (
        <span
          key={outgoing}
          aria-hidden
          className="col-start-1 row-start-1 animate-count-out motion-reduce:hidden"
          onAnimationEnd={() => setSeen((s) => ({ ...s, outgoing: null }))}
        >
          {outgoing}
        </span>
      )}
      <span
        key={value}
        className={cn(
          'col-start-1 row-start-1 motion-reduce:animate-none',
          outgoing !== null && 'animate-count-in',
        )}
      >
        {value}
      </span>
    </span>
  );
}
