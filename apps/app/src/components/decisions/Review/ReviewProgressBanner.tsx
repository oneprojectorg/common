'use client';

import { trpc } from '@op/api/client';
import { GradientHeader } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';

import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

export function ReviewProgressBanner({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId?: string;
}) {
  const t = useTranslations();

  const [progress] = trpc.decision.getPhaseReviewProgress.useSuspenseQuery({
    processInstanceId,
    ...(phaseId && { phaseId }),
  });

  return (
    <BannerShell>
      <div className="flex flex-wrap items-center justify-center gap-6 py-2">
        <ReviewProgressStat
          value={`${progress.proposalsReviewed}/${progress.proposalsTotal}`}
          label={t('Proposals Reviewed')}
        />
        <Divider />
        <ReviewProgressStat
          value={`${progress.activeReviewers}/${progress.reviewersTotal}`}
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
      <div className="flex flex-wrap items-center justify-center gap-6 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex w-[100px] flex-col items-center gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </BannerShell>
  );
}

function BannerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <GradientHeader className="items-center align-middle uppercase">
        <TranslatedText text="Review Progress" />
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
      <span className="font-serif text-title-lg text-neutral-charcoal">
        {value}
      </span>
      <span className="text-sm whitespace-nowrap text-neutral-charcoal">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-neutral-gray2" />;
}
