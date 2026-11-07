'use client';

import { Badge } from '@op/sense/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

type ProposalSheetTabListProps = Omit<
  ComponentProps<typeof TabsList>,
  'variant' | 'aria-label'
> & {
  'aria-label': string;
};

type ProposalSheetTabTriggerProps = ComponentProps<typeof TabsTrigger> & {
  /** Shown after the label, e.g. a number of reviews. */
  count?: ReactNode;
};

export function ProposalSheetTabs(props: ComponentProps<typeof Tabs>) {
  return <Tabs {...props} />;
}

export function ProposalSheetTabList({
  className,
  ...props
}: ProposalSheetTabListProps) {
  return (
    // sense `TabsList` is `w-fit`, so the underline track comes from a
    // full-width wrapper.
    <div className="w-full border-b">
      <TabsList
        variant="line"
        className={cn('flex gap-4 overflow-x-auto', className)}
        {...props}
      />
    </div>
  );
}

export function ProposalSheetTabTrigger({
  count,
  children,
  ...props
}: ProposalSheetTabTriggerProps) {
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

export function ProposalSheetTabPanel(
  props: ComponentProps<typeof TabsContent>,
) {
  return <TabsContent {...props} />;
}
