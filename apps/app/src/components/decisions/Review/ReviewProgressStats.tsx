'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

export function ReviewProgressStats({
  processInstanceId,
  phaseId,
  hasImage = false,
}: {
  processInstanceId: string;
  phaseId: string;
  /** Over a banner image the charcoal stats lose contrast — use white. */
  hasImage?: boolean;
}) {
  return (
    <APIErrorBoundary fallbacks={{ default: () => null }}>
      <Suspense fallback={<ReviewProgressStatsSkeleton />}>
        <ReviewProgressStatsContent
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          hasImage={hasImage}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewProgressStatsContent({
  processInstanceId,
  phaseId,
  hasImage,
}: {
  processInstanceId: string;
  phaseId: string;
  hasImage?: boolean;
}) {
  const t = useTranslations();

  const [progress] = trpc.decision.getPhaseReviewProgress.useSuspenseQuery({
    processInstanceId,
    phaseId,
  });

  return (
    <StatsRow>
      <ReviewProgressStat
        value={`${progress.proposalsReviewedCount}/${progress.proposalsTotalCount}`}
        label={t('Proposals Reviewed')}
        hasImage={hasImage}
      />
      <Divider />
      <ReviewProgressStat
        value={`${progress.activeReviewersCount}/${progress.reviewersTotalCount}`}
        label={t('Active Reviewers')}
        hasImage={hasImage}
      />
      {progress.daysLeft !== null ? (
        <>
          <Divider />
          <ReviewProgressStat
            value={String(progress.daysLeft)}
            label={t('Days left')}
            hasImage={hasImage}
          />
        </>
      ) : null}
    </StatsRow>
  );
}

function ReviewProgressStatsSkeleton() {
  return (
    <StatsRow>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex w-24 flex-col items-center gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </StatsRow>
  );
}

function StatsRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-6 py-2">
      {children}
    </div>
  );
}

function ReviewProgressStat({
  value,
  label,
  hasImage,
}: {
  value: string;
  label: string;
  hasImage?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center',
        hasImage ? 'text-white' : 'text-foreground',
      )}
    >
      <span className="font-serif text-headline">{value}</span>
      <span className="text-sm whitespace-nowrap">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-border" />;
}
