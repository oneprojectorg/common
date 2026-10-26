'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';

import { useTranslations } from '@/lib/i18n';

import { DecisionStat, DecisionStats } from './DecisionStats';

interface ResultsStatsProps {
  instanceId: string;
}

export function ResultsStats({ instanceId }: ResultsStatsProps) {
  const t = useTranslations('decisions');

  const [stats] = trpc.decision.getResultsStats.useSuspenseQuery({
    instanceId,
  });

  if (!stats) {
    return null;
  }

  return (
    <DecisionStats>
      {stats.membersVoted > 0 && (
        <DecisionStat
          value={stats.membersVoted}
          label={t('membersVotedStat')}
        />
      )}
      <DecisionStat
        value={stats.proposalsFunded}
        label={t('proposalsSelectedStat')}
      />
      {stats.totalAllocated > 0 && (
        <DecisionStat
          value={formatCurrency(stats.totalAllocated)}
          label={t('totalAllocatedStat')}
        />
      )}
    </DecisionStats>
  );
}
