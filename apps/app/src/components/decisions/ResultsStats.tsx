'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

const StatNumber = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-center font-serif text-title-lg !text-neutral-offWhite',
        className,
      )}
    >
      {children}
    </div>
  );
};

const StatLabel = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="flex items-center justify-center text-center text-sm text-neutral-offWhite">
      {children}
    </div>
  );
};

const Stat = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="flex min-w-24 flex-col items-center gap-2">{children}</div>
  );
};

interface ResultsStatsProps {
  instanceId: string;
}

export function ResultsStats({ instanceId }: ResultsStatsProps) {
  const [stats] = trpc.decision.getResultsStats.useSuspenseQuery({
    instanceId,
  });

  if (!stats) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
        <Stat>
          <StatNumber>{stats.membersVoted}</StatNumber>
          <StatLabel>Members Voted</StatLabel>
        </Stat>
        <hr className="hidden h-8 w-0.5 bg-white/50 sm:block" />
        <Stat>
          <StatNumber>{stats.proposalsFunded}</StatNumber>
          <StatLabel>Proposals Funded</StatLabel>
        </Stat>
        <hr className="hidden h-8 w-0.5 bg-white/50 sm:block" />
        <Stat>
          <StatNumber>{formatCurrency(stats.totalAllocated)}</StatNumber>
          <StatLabel>Total Allocated</StatLabel>
        </Stat>
      </div>
    </div>
  );
}
