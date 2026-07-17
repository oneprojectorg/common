'use client';

import { trpc } from '@op/api/client';
import type { AdminDecisionPhase } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { useFormatter } from 'next-intl';
import { Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

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
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/decisions"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LuArrowLeft className="size-3.5 rtl:rotate-180" />
          {t('All Decisions')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-title-lg">{detail.name}</h1>
          {detail.status ? (
            <Badge variant="secondary">
              {STATUS_DISPLAY[detail.status] ?? detail.status}
            </Badge>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-2">
          <MetaItem label={t('Owner')} value={detail.owner?.name ?? '—'} />
          <MetaItem label={t('Steward')} value={detail.steward?.name ?? '—'} />
          <MetaItem
            label={t('Reviews policy')}
            value={detail.reviewsPolicy?.replaceAll('_', ' ') ?? '—'}
          />
          <MetaItem
            label={t('Created')}
            value={
              createdAt
                ? format.dateTime(createdAt, { dateStyle: 'medium' })
                : '—'
            }
          />
        </dl>
      </div>

      <Tabs defaultValue="phases">
        <TabsList variant="line">
          <TabsTrigger value="phases">{t('Phases')}</TabsTrigger>
          <TabsTrigger value="members">{t('Members')}</TabsTrigger>
        </TabsList>
        <TabsContent value="phases" className="flex flex-col gap-6 pt-4">
          {detail.phases.map((phase, index) => (
            <PhaseCard
              key={phase.phaseId}
              instanceId={instanceId}
              phase={phase}
              index={index}
              total={detail.phases.length}
              currentIndex={detail.phases.findIndex((p) => p.isCurrent)}
            />
          ))}
        </TabsContent>
        <TabsContent value="members" className="pt-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

const MetaItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm capitalize">{value}</dd>
    </div>
  );
};

const PhaseCard = ({
  instanceId,
  phase,
  index,
  total,
  currentIndex,
}: {
  instanceId: string;
  phase: AdminDecisionPhase;
  index: number;
  total: number;
  /** Index of the current phase, -1 when the process has no current phase. */
  currentIndex: number;
}) => {
  const t = useTranslations();
  const format = useFormatter();

  const formatDate = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: 'medium' }) : null;
  const startDate = formatDate(phase.startDate);
  const endDate = formatDate(phase.endDate);
  const dates =
    startDate && endDate
      ? t('{start} – {end}', { start: startDate, end: endDate })
      : (startDate ?? endDate);

  const hasAnySection =
    phase.hasProposals || phase.hasReviews || phase.hasVoting;
  const isCompleted = currentIndex >= 0 && index < currentIndex;

  return (
    <Card
      className={
        phase.isCurrent
          ? 'border-primary'
          : isCompleted
            ? 'bg-muted'
            : undefined
      }
    >
      <CardHeader className={hasAnySection ? 'border-b' : undefined}>
        <CardTitle>
          {phase.name ?? t('Phase {number}', { number: index + 1 })}
        </CardTitle>
        <CardDescription>
          {t('Phase {number} of {total}', { number: index + 1, total })}
          {dates ? <span> · {dates}</span> : null}
        </CardDescription>
        {currentIndex >= 0 ? (
          <CardAction>
            {phase.isCurrent ? (
              <Badge>{t('Current phase')}</Badge>
            ) : index < currentIndex ? (
              <Badge variant="secondary">{t('Completed')}</Badge>
            ) : (
              <Badge variant="outline">{t('Upcoming')}</Badge>
            )}
          </CardAction>
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
                isCompleted={isCompleted}
              />
            </Suspense>
          </PhaseSection>
        ) : null}
        {phase.hasVoting ? (
          <PhaseSection title={t('Voting')}>
            <ComingSoon />
          </PhaseSection>
        ) : null}
        {!hasAnySection ? (
          <p className="text-sm text-muted-foreground">
            {t('Nothing to manage in this phase.')}
          </p>
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
      <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
};

const ComingSoon = () => {
  const t = useTranslations();

  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
      {t('Coming soon')}
    </p>
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
