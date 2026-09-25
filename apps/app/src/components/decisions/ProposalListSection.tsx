import { Header3 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

/**
 * The column a proposal tab renders into. The gap matches the tab rail's, so
 * every tab's heading sits the same distance below it.
 */
export const ProposalListSection = ({
  heading,
  className,
  children,
}: {
  heading: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn('flex flex-col gap-6 pb-12', className)}>
    <Header3>{heading}</Header3>
    {children}
  </div>
);
