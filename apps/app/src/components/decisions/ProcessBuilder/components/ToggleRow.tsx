'use client';

import { Button } from '@op/ui/Button';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { LuCircleHelp } from 'react-icons/lu';

// Toggle row component for consistent styling
export function ToggleRow({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <span className="text-base">{label}</span>
        {tooltip && (
          <TooltipTrigger>
            <Button unstyled className="text-neutral-gray4">
              <LuCircleHelp className="size-4" />
            </Button>
            <Tooltip>{tooltip}</Tooltip>
          </TooltipTrigger>
        )}
      </div>
      {children}
    </div>
  );
}
