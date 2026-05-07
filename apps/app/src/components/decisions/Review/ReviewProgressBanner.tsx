'use client';

import { trpc } from '@op/api/client';
import { GradientHeader } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';

import { useTranslations } from '@/lib/i18n';

export function ReviewProgressBanner({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
}) {
  const t = useTranslations();

  const [progress] = trpc.decision.getPhaseReviewProgress.useSuspenseQuery({
    processInstanceId,
    phaseId,
  });

  return (
    <BannerShell>
      <div className="flex w-full flex-wrap items-center justify-center gap-6 py-2">
        <ReviewProgressStat
          value={`${progress.proposalsReviewedCount}/${progress.proposalsTotalCount}`}
          label={t('Proposals Reviewed')}
        />
        <Divider />
        <ReviewProgressStat
          value={`${progress.activeReviewersCount}/${progress.reviewersTotalCount}`}
          label={t('Active Reviewers')}
        />
        {progress.daysLeft !== null ? (
          <>
            <Divider />
            <ReviewProgressStat
              value={String(progress.daysLeft)}
              label={t('Days left')}
            />
          </>
        ) : null}
      </div>
    </BannerShell>
  );
}

export function ReviewProgressBannerSkeleton() {
  return (
    <BannerShell>
      <div className="flex w-full flex-wrap items-center justify-center gap-6 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex w-24 flex-col items-center gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </BannerShell>
  );
}

function BannerShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <GradientHeader className="uppercase">
        {t('Review Progress')}
      </GradientHeader>
      {children}
    </div>
  );
}

function ReviewProgressStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-neutral-charcoal">
      <span className="font-serif text-title-lg">{value}</span>
      <span className="text-sm whitespace-nowrap">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-neutral-gray2" />;
}
