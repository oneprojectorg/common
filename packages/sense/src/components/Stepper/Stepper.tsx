import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

/**
 * Shows its children only while `currentStep` equals `itemIndex`. Inactive
 * steps stay mounted and are hidden with `display: none`, so their form state
 * survives navigation — but they are also removed from the accessibility tree,
 * which is what you want here.
 */
export const StepItem = ({
  currentStep,
  itemIndex,
  children,
}: {
  currentStep: number;
  itemIndex: number;
  children: ReactNode;
}) => (
  <div className={cn(currentStep !== itemIndex && 'hidden')}>{children}</div>
);

/**
 * The thin gradient bar that fills as the user advances through steps.
 *
 * Purely visual — plain `div`s with no progressbar role, so it is invisible to
 * a screen reader. That's deliberate (announcing a raw percentage on every step
 * change is noise), but it means the surrounding flow owes an announcement of
 * its own: "Step 2 of 5" in the step heading, or an `aria-live` region.
 *
 * Prefer `@op/sense/Progress` when you actually want a semantic progress bar.
 */
export const StepperProgressIndicator = ({
  numItems,
  currentStep = 0,
}: {
  numItems: number;
  currentStep?: number;
}) => {
  const segmentSize = 100 / numItems;
  const progress = numItems > 1 ? (currentStep + 1) * segmentSize : 0;

  return (
    <div className="relative z-40 flex h-1 w-full gap-0 bg-gradient">
      <div className="absolute inset-0 bg-background/65" />
      <div
        className="absolute start-0 top-0 h-full bg-gradient transition-[width] duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
