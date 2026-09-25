import { Header3 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

// Gap matches the tab bar's, so every tab's heading sits level with the rest.
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
