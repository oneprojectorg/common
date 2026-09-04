'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

/**
 * A dotted-underline value (e.g. a relative timestamp) that reveals a fuller
 * form on hover/focus. Trigger is a focusable span so it stays keyboard- and
 * screen-reader-reachable.
 */
export const TimestampTooltip = ({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title: string;
  className?: string;
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className={cn(
                'cursor-default underline decoration-dotted underline-offset-2 outline-hidden',
                className,
              )}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
