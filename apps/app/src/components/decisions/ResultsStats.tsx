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
    <div className="min-w-24 gap-2 flex flex-col items-center">{children}</div>
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
    <div className="gap-2 flex w-full flex-col">
      <div className="gap-2 sm:gap-6 flex flex-col items-center justify-center xxs:flex-row">
        {stats.membersVoted > 0 && (
          <>
            <Stat>
              <StatNumber>{stats.membersVoted}</StatNumber>
              <StatLabel>{t('Members Voted')}</StatLabel>
            </Stat>
            <hr className="h-8 w-0.5 hidden border-0 bg-white/50 xxs:block" />
          </>
        )}
        <Stat>
          <StatNumber>{stats.proposalsFunded}</StatNumber>
          <StatLabel>{t('Proposals Funded')}</StatLabel>
        </Stat>
        <hr className="h-8 w-0.5 hidden border-0 bg-white/50 xxs:block" />
        <Stat>
          <StatNumber>{formatCurrency(stats.totalAllocated)}</StatNumber>
          <StatLabel>{t('Total Allocated')}</StatLabel>
        </Stat>
      </div>
    </div>
  );
}
