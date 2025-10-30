'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { Surface } from '@op/ui/Surface';
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
    <div className="text-transparent">
      <div
        className={cn(
          'flex items-center justify-center bg-gradient bg-clip-text font-serif text-title-xxl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};

const StatLabel = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="flex items-center justify-center text-center text-neutral-charcoal">
      {children}
    </div>
  );
};

const Stat = ({ children }: { children?: ReactNode }) => {
  return <div className="flex flex-col items-center gap-2">{children}</div>;
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
    <div className="flex w-full flex-col gap-4">
      <Surface className="shadow-light">
        <div className="flex flex-col items-center justify-between gap-8 px-10 py-8 sm:flex-row sm:gap-4">
          <Stat>
            <StatNumber className="bg-redOrange">
              {stats.membersVoted}
            </StatNumber>
            <StatLabel>Members Voted</StatLabel>
          </Stat>
          <hr className="hidden h-20 w-0.5 bg-neutral-gray1 sm:block" />
          <Stat>
            <StatNumber className="bg-orange">{stats.proposalsFunded}</StatNumber>
            <StatLabel>Proposals Funded</StatLabel>
          </Stat>
          <hr className="hidden h-20 w-0.5 bg-neutral-gray1 sm:block" />
          <Stat>
            <StatNumber className="bg-redPurple">
              {formatCurrency(stats.totalAllocated)}
            </StatNumber>
            <StatLabel>Total Allocated</StatLabel>
          </Stat>
        </div>
      </Surface>
    </div>
  );
}
