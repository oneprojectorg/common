'use client';

import { formatMoney } from '@/utils/formatting';
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
    <div className="flex min-w-24 flex-col items-center gap-2">{children}</div>
  );
};

interface ResultsStatsProps {
  instanceId: string;
  /**
   * The process's budget currency. `totalAllocated` is a bare sum with no
   * currency of its own, and this banner sits directly above proposal cards
   * that render theirs — without this the same money is labelled two ways on
   * one page.
   */
  currency: string;
}

export function ResultsStats({ instanceId, currency }: ResultsStatsProps) {
  const t = useTranslations();

  const [stats] = trpc.decision.getResultsStats.useSuspenseQuery({
    instanceId,
  });

  if (!stats) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-col items-center justify-center gap-2 xxs:flex-row sm:gap-6">
        {stats.membersVoted > 0 && (
          <>
            <Stat>
              <StatNumber>{stats.membersVoted}</StatNumber>
              <StatLabel>{t('Members Voted')}</StatLabel>
            </Stat>
            <hr className="hidden h-8 w-0.5 border-0 bg-white/50 xxs:block" />
          </>
        )}
        <Stat>
          <StatNumber>{stats.proposalsFunded}</StatNumber>
          <StatLabel>{t('Proposals Funded')}</StatLabel>
        </Stat>
        <hr className="hidden h-8 w-0.5 border-0 bg-white/50 xxs:block" />
        <Stat>
          <StatNumber>
            {formatMoney({ amount: stats.totalAllocated, currency })}
          </StatNumber>
          <StatLabel>{t('Total Allocated')}</StatLabel>
        </Stat>
      </div>
    </div>
  );
}
