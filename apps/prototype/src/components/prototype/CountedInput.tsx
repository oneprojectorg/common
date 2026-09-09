'use client';

import { Input } from '@op/sense/Input';
import { cn } from '@op/sense/lib/utils';
import type { ComponentProps } from 'react';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A capped field that says how much room is left, inside itself. Under the field
 * the count was a row of its own — it pushed everything below it down, and sat
 * where a description sits while saying nothing about what to type. In the field
 * it belongs to the control it counts.
 *
 * Sense's `Input`, padded to clear the count and otherwise untouched: the focus
 * ring, the invalid state and the direction resolved from the value all still
 * come from the design system.
 */
export function CountedInput({
  value,
  limit,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'maxLength'> & {
  value: string;
  limit: number;
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        maxLength={limit}
        /* Clear of the count, which is as wide as the limit is long: "50/50" is
           five glyphs, "250/250" is seven. Both plus the field's own 12 of end
           padding — a fixed reserve fits one and clips the other. */
        className={cn(String(limit).length > 2 ? 'pe-20' : 'pe-16', className)}
        {...props}
      />
      {/* Announced, because it is the only warning that the field is nearly
          full. `tabular-nums` so the digits don't shift the count as it grows. */}
      <span
        aria-live="polite"
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground tabular-nums"
      >
        {value.length}/{limit}
      </span>
    </div>
  );
}
