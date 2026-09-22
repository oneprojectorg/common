'use client';

import { Header1 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';

/** Focus target on a step change, so the new question gets announced. */
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
      <Header1
        id={STEP_HEADING_ID}
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
