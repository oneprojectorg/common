'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';

import { cn } from '../../lib/utils';

interface RankCheckboxProps extends CheckboxPrimitive.Root.Props {
  /** 1-based position shown inside the circle while checked. */
  rank?: number;
}

/**
 * A round checkbox that shows its rank while checked — the ballot toggle on a
 * ranked-choice vote, where the order of picks is the order of preference.
 *
 * The rank is visual only; put it in the control's accessible name as well.
 */
function RankCheckbox({ rank, className, ...props }: RankCheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="rank-checkbox"
      className={cn(
        'peer relative flex size-6 shrink-0 items-center justify-center rounded-full border border-input bg-background text-xs font-medium tabular-nums transition-colors outline-none after:absolute after:-inset-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="rank-checkbox-indicator"
        aria-hidden
      >
        {rank}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { RankCheckbox, type RankCheckboxProps };
