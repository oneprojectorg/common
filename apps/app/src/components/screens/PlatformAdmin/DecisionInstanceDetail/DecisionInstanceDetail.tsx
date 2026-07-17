'use client';

import { trpc } from '@op/api/client';
import type { AdminDecisionPhase } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { Empty, EmptyDescription, EmptyTitle } from '@op/sense/Empty';
import { Skeleton } from '@op/sense/Skeleton';
import { useFormatter } from 'next-intl';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewPhasePanel } from './ReviewPhasePanel';

const STATUS_DISPLAY: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Platform-admin drill-down for a single decision process instance. */
export const DecisionInstanceDetail = ({
  instanceId,
}: {
  instanceId: string;
}) => {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DecisionInstanceDetailContent instanceId={instanceId} />
    </Suspense>
  );
};

const DecisionInstanceDetailContent = ({
  instanceId,
}: {
  instanceId: string;
}) => {
  const t = useTranslations();
  const format = useFormatter();
  const [detail] = trpc.platform.admin.getDecisionInstance.useSuspenseQuery({
    instanceId,
  });

  const createdAt = detail.createdAt ? new Date(detail.createdAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-title-lg">{detail.name}</h1>
          {detail.status ? (
            <Badge variant="secondary">
              {STATUS_DISPLAY[detail.status] ?? detail.status}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-charcoal">
          <span>{t('Owner: {name}', { name: detail.owner?.name ?? '—' })}</span>
          <span>
            {t('Steward: {name}', { name: detail.steward?.name ?? '—' })}
          </span>
          <span>
            {t('Reviews policy: {policy}', {
              policy: detail.reviewsPolicy ?? '—',
            })}
          </span>
          {createdAt ? (
            <span>
              {t('Created {date}', {
                date: format.dateTime(createdAt, { dateStyle: 'medium' }),
              })}
            </span>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Members')}</CardTitle>
          <CardDescription>
            {t('Members, roles, and invite statuses')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComingSoon />
        </CardContent>
      </Card>

      {detail.phases.map((phase, index) => (
        <PhaseCard
          key={phase.phaseId}
          instanceId={instanceId}
          phase={phase}
          index={index}
        />
      ))}
    </div>
  );
};

const PhaseCard = ({
  instanceId,
  phase,
  index,
}: {
  instanceId: string;
  phase: AdminDecisionPhase;
  index: number;
}) => {
  const t = useTranslations();
  const format = useFormatter();

  const formatDate = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: 'medium' }) : null;
  const startDate = formatDate(phase.startDate);
  const endDate = formatDate(phase.endDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {phase.name ?? t('Phase {number}', { number: index + 1 })}
          {phase.isCurrent ? <Badge>{t('Current phase')}</Badge> : null}
          {phase.hasProposals ? (
            <Badge variant="outline">{t('Proposals')}</Badge>
          ) : null}
          {phase.hasReviews ? (
            <Badge variant="outline">{t('Reviews')}</Badge>
          ) : null}
          {phase.hasVoting ? (
            <Badge variant="outline">{t('Voting')}</Badge>
          ) : null}
        </CardTitle>
        {startDate || endDate ? (
          <CardDescription>
            {startDate && endDate
              ? t('{start} – {end}', { start: startDate, end: endDate })
              : (startDate ?? endDate)}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {phase.hasProposals ? (
          <PhaseSection title={t('Proposals')}>
            <ComingSoon />
          </PhaseSection>
        ) : null}
        {phase.hasReviews ? (
          <PhaseSection title={t('Reviews')}>
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <ReviewPhasePanel
                instanceId={instanceId}
                phaseId={phase.phaseId}
              />
            </Suspense>
          </PhaseSection>
        ) : null}
        {phase.hasVoting ? (
          <PhaseSection title={t('Voting')}>
            <ComingSoon />
          </PhaseSection>
        ) : null}
        {!phase.hasProposals && !phase.hasReviews && !phase.hasVoting ? (
          <ComingSoon />
        ) : null}
      </CardContent>
    </Card>
  );
};

const PhaseSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-neutral-charcoal">{title}</h3>
      {children}
    </section>
  );
};

const ComingSoon = () => {
  const t = useTranslations();

  return (
    <Empty className="border border-dashed py-8">
      <EmptyTitle>{t('Coming soon')}</EmptyTitle>
      <EmptyDescription>
        {t('This section is not available yet.')}
      </EmptyDescription>
    </Empty>
  );
};

const DetailSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-96" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
};
