// Compatibility wrapper for @op/ui's Tooltip. Preserves the RAC sibling pattern:
//
//   <TooltipTrigger>
//     <Button>Trigger</Button>
//     <Tooltip>Content</Tooltip>
//   </TooltipTrigger>
//
// Under the hood we re-host the tree on shadcn's nested pattern:
//
//   <Tooltip>
//     <TooltipTrigger render={<Button />} />
//     <TooltipContent>Content</TooltipContent>
//   </Tooltip>

'use client';

import * as React from 'react';

import {
  Tooltip as ShadcnTooltipRoot,
  TooltipContent as ShadcnTooltipContent,
  TooltipProvider as ShadcnTooltipProvider,
  TooltipTrigger as ShadcnTooltipTrigger,
} from '@/components/ui/tooltip';

export interface TooltipProps {
  children?: React.ReactNode;
  className?: string;
  offset?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ children, className, offset, side }: TooltipProps) {
  return (
    <ShadcnTooltipContent
      sideOffset={offset ?? 4}
      side={side}
      className={className}
    >
      <div className="op-ui-Tooltip grid items-center">{children}</div>
    </ShadcnTooltipContent>
  );
}

export interface TooltipTriggerProps {
  children: React.ReactNode;
  delay?: number;
  closeDelay?: number;
}

export function TooltipTrigger({
  children,
  delay = 500,
  closeDelay = 0,
}: TooltipTriggerProps) {
  const arr = React.Children.toArray(children);
  const tooltipChild = arr.find(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === Tooltip,
  );
  const triggerChildren = arr.filter((child) => child !== tooltipChild);

  const triggerNode =
    triggerChildren.length === 1 && React.isValidElement(triggerChildren[0])
      ? triggerChildren[0]
      : ((<span>{triggerChildren}</span>) as React.ReactElement);

  return (
    <ShadcnTooltipProvider delay={delay} closeDelay={closeDelay}>
      <ShadcnTooltipRoot>
        <ShadcnTooltipTrigger render={triggerNode} />
        {tooltipChild}
      </ShadcnTooltipRoot>
    </ShadcnTooltipProvider>
  );
}
