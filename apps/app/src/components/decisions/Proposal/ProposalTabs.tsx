'use client';

import { Badge } from '@op/sense/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

type ProposalTabListProps = Omit<
  ComponentProps<typeof TabsList>,
  'variant' | 'fullWidth' | 'aria-label'
> & {
  'aria-label': string;
};

type ProposalTabTriggerProps = ComponentProps<typeof TabsTrigger> & {
  /** Shown after the label, e.g. a number of reviews. */
  count?: ReactNode;
};

/** Sections below a proposal, e.g. its reviews and its comments. */
export function ProposalTabs(props: ComponentProps<typeof Tabs>) {
  return <Tabs {...props} />;
}

export function ProposalTabList({ className, ...props }: ProposalTabListProps) {
  return (
    <TabsList
      variant="line"
      fullWidth
      className={cn('flex gap-4 overflow-x-auto', className)}
      {...props}
    />
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

/** Pass `keepMounted` to keep a panel's state, e.g. a half-typed comment. */
export function ProposalTabPanel(props: ComponentProps<typeof TabsContent>) {
  return <TabsContent {...props} />;
}
