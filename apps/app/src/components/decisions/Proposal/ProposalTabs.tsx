'use client';

import { Badge } from '@op/sense/Badge';
import { TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

type ProposalTabListProps = Omit<
  ComponentProps<typeof TabsList>,
  'variant' | 'aria-label'
> & {
  'aria-label': string;
};

type ProposalTabTriggerProps = ComponentProps<typeof TabsTrigger> & {
  /** Shown after the label, e.g. a number of reviews. */
  count?: ReactNode;
};

export function ProposalTabList({ className, ...props }: ProposalTabListProps) {
  return (
    <div className="w-full border-b">
      <TabsList
        variant="line"
        className={cn('flex gap-4 overflow-x-auto', className)}
        {...props}
      />
    </div>
  );
}

export function ProposalTabTrigger({
  count,
  children,
  ...props
}: ProposalTabTriggerProps) {
  return (
    <TabsTrigger {...props}>
      {children}
      {/* A count that is still loading renders nothing; hide the empty pill. */}
      {count === undefined ? null : (
        <Badge variant="secondary" className="empty:hidden">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}
