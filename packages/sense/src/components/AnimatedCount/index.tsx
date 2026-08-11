'use client';

import { useRef } from 'react';

import { cn } from '../../lib/utils';

/**
 * A number that slides as it changes — up when it grows, down when it shrinks.
 *
 * The span is keyed on the value, so React swaps the element and the CSS
 * animation plays on mount. No JS animation loop and no measurement: the travel
 * is in `em`, so it tracks whatever text size it inherits, including the sense
 * steps that change at the md breakpoint.
 *
 * Silent on first paint — a grid of cards shouldn't tick as it loads — and
 * `motion-reduce` drops it to a straight swap.
 */
export function AnimatedCount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const previous = useRef(value);
  // Direction is remembered rather than recomputed per render: under StrictMode
  // the second render sees `previous` already caught up, and comparing there
  // would call every change a decrease.
  const direction = useRef<'up' | 'down' | null>(null);

  if (previous.current !== value) {
    direction.current = value > previous.current ? 'up' : 'down';
    previous.current = value;
  }

  return (
    <span
      key={value}
      className={cn(
        'inline-block tabular-nums',
        direction.current === 'up' && 'animate-count-up',
        direction.current === 'down' && 'animate-count-down',
        'motion-reduce:animate-none',
        className,
      )}
    >
      {value}
    </span>
  );
}
