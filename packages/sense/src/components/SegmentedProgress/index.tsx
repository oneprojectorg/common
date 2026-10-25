'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';

import { cn } from '../../lib/utils';
import { ProgressTrack } from '../ui/progress';

interface SegmentedProgressSegment {
  id: string;
  /** Share of `max` this segment fills. */
  value: number;
}

interface SegmentedProgressProps extends Omit<
  ProgressPrimitive.Root.Props,
  'value' | 'children'
> {
  /** Filled left to right in order; the bar's value is their sum. */
  segments: SegmentedProgressSegment[];
}

/**
 * A progress bar split into one segment per contribution — a budget filled by
 * each pick, say. Reports the summed value to assistive tech like `Progress`;
 * pass `aria-label` and `getAriaValueText` to name it.
 */
function SegmentedProgress({
  segments,
  max = 100,
  className,
  ...props
}: SegmentedProgressProps) {
  const filled = segments.filter(({ value }) => value > 0);
  const total = filled.reduce((sum, { value }) => sum + value, 0);

  return (
    <ProgressPrimitive.Root
      data-slot="segmented-progress"
      value={Math.min(total, max)}
      max={max}
      className={cn('w-full', className)}
      {...props}
    >
      <ProgressTrack className="h-2 gap-0.5">
        {filled.map(({ id, value }) => (
          <span
            key={id}
            data-slot="segmented-progress-segment"
            className="h-full shrink-0 bg-primary"
            style={{ width: `${(value / max) * 100}%` }}
          />
        ))}
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

export {
  SegmentedProgress,
  type SegmentedProgressProps,
  type SegmentedProgressSegment,
};
