'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/sense/Skeleton';
import { useFormatter } from 'next-intl';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DecisionStat,
  DecisionStatDivider,
  DecisionStats,
} from './DecisionStats';

export function VotingProgressStats({
  processInstanceId,
  hasImage = false,
}: {
  processInstanceId: string;
  /** Over a banner image the stats use white text. */
  hasImage?: boolean;
}) {
  return (
    <div
      aria-live="polite"
      className={hasImage ? 'text-white' : 'text-foreground'}
    >
      <APIErrorBoundary fallbacks={{ default: () => null }}>
        <Suspense fallback={<VotingProgressStatsSkeleton />}>
          <VotingProgressStatsSuspense processInstanceId={processInstanceId} />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function VotingProgressStatsSuspense({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations('decisions');
  const format = useFormatter();

  const [progress] = trpc.decision.getVotingProgress.useSuspenseQuery({
    processInstanceId,
  });

  return (
    <DecisionStats>
      <DecisionStat
        value={`${format.number(progress.participantsVotedCount)}/${format.number(progress.participantsEligibleCount)}`}
        label={t('participantsVotedStat')}
      />
      <DecisionStatDivider />
      <DecisionStat
        value={format.number(progress.turnoutPercentage / 100, {
          style: 'percent',
        })}
        label={t('turnoutStat')}
      />
      {progress.daysLeft !== null ? (
        <>
          <DecisionStatDivider />
          <DecisionStat
            value={format.number(progress.daysLeft)}
            label={t('daysLeftStat')}
          />
        </>
      ) : null}
    </DecisionStats>
  );
}

function VotingProgressStatsSkeleton() {
  const placeholder = (
    <DecisionStat
      value={<Skeleton className="h-8 w-16" />}
      label={<Skeleton className="h-4 w-24" />}
    />
  );

  return (
    <DecisionStats>
      {placeholder}
      <DecisionStatDivider />
      {placeholder}
      <DecisionStatDivider />
      {placeholder}
    </DecisionStats>
  );
}
