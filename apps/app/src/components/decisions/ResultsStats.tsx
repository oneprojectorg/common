'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

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
        'text-title-lg !text-neutral-offWhite flex items-center justify-center font-serif',
        className,
      )}
    >
      {children}
    </div>
  );
};

const StatLabel = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="text-neutral-offWhite flex items-center justify-center text-center text-sm">
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
  const t = useTranslations();

  const [stats] = trpc.decision.getResultsStats.useSuspenseQuery({
    instanceId,
  });

  if (!stats) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="xxs:flex-row flex flex-col items-center justify-center gap-2 sm:gap-6">
        {stats.membersVoted > 0 && (
          <>
            <Stat>
              <StatNumber>{stats.membersVoted}</StatNumber>
              <StatLabel>{t('Members Voted')}</StatLabel>
            </Stat>
            <hr className="xxs:block hidden h-8 w-0.5 border-0 bg-white/50" />
          </>
        )}
        <Stat>
          <StatNumber>{stats.proposalsFunded}</StatNumber>
          <StatLabel>{t('Proposals Funded')}</StatLabel>
        </Stat>
        <hr className="xxs:block hidden h-8 w-0.5 border-0 bg-white/50" />
        <Stat>
          <StatNumber>{formatCurrency(stats.totalAllocated)}</StatNumber>
          <StatLabel>{t('Total Allocated')}</StatLabel>
        </Stat>
      </div>
    </div>
  );
}
