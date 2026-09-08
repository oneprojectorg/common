'use client';

import { Header1 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';

/**
 * Every question screen in the wizard is titled the same way, so the flow reads
 * as one sequence. The heading also carries the focus target for a step change:
 * the shell moves focus here so a screen reader announces the new question
 * instead of leaving the user where the previous step's control was.
 */
export const STEP_HEADING_ID = 'create-process-step-heading';

export function StepHeading({
  title,
  description,
  size = 'headline',
  className,
}: {
  title: string;
  description?: string;
  /** `display` for the opening screen, `headline` for the questions. */
  size?: 'display' | 'headline';
  className?: string;
}) {
  return (
    <div className={cn('text-center', className)}>
      {/* Always an `h1`: one step is on screen at a time and its question is
          that screen's heading. Only the size varies. */}
      <Header1
        id={STEP_HEADING_ID}
        // Focused programmatically on each step change; never in the tab order.
        tabIndex={-1}
        className={cn(
          'text-balance outline-none',
          size === 'headline' && 'text-headline',
        )}
      >
        {title}
      </Header1>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
