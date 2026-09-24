import { Header3 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

/**
 * The column a proposal tab renders into: its heading, then the cards, on one
 * gap and one bottom inset.
 *
 * Each tab used to carry its own copy and they had drifted — two different
 * gaps, and a wrapper around the heading on one but not the other. The gap
 * matches the one the tab rail itself sets, so the heading sits the same
 * distance below the rail on every tab.
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
