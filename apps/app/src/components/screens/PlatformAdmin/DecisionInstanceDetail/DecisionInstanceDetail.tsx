'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionConfig,
  AdminDecisionPhase,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { buttonVariants } from '@op/sense/Button';
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
import { LuArrowLeft, LuArrowUpRight } from 'react-icons/lu';

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
          <LuArrowLeft className="size-3.5 rtl:-scale-x-100" />
          {t('All Decisions')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-title-lg">{detail.name}</h1>
          {detail.status ? (
            <Badge variant="secondary">
              {STATUS_DISPLAY[detail.status] ?? detail.status}
            </Badge>
          ) : null}
          {detail.slug ? (
            <Link
              href={`/decisions/${detail.slug}`}
              className={`${buttonVariants({ variant: 'outline', size: 'sm' })} ms-auto`}
            >
              {t('View decision')}
              <LuArrowUpRight
                data-icon="inline-end"
                className="rtl:-scale-x-100"
              />
            </Link>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-2">
          <MetaItem label={t('Owner')} value={detail.owner?.name ?? '—'} />
          <MetaItem label={t('Steward')} value={detail.steward?.name ?? '—'} />
          <MetaItem
            label={t('Process type')}
            value={
              detail.processType
                ? detail.templateVersion
                  ? `${detail.processType} (v${detail.templateVersion})`
                  : detail.processType
                : '—'
            }
          />
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
          <TabsTrigger value="configuration">{t('Configuration')}</TabsTrigger>
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
        <TabsContent value="configuration" className="pt-4">
          <ConfigurationCard config={detail.config} />
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

  const ruleParts = [
    phase.hasProposals &&
      (phase.proposalsHiddenByDefault
        ? t('Proposal submissions (hidden by default)')
        : t('Proposal submissions')),
    phase.canEditProposals && t('Proposal editing'),
    phase.hasReviews && t('Reviews'),
    phase.hasVoting &&
      (phase.maxVotesPerMember != null
        ? t('Voting (max {count} per member)', {
            count: phase.maxVotesPerMember,
          })
        : t('Voting')),
    phase.canEditVotes && t('Vote editing'),
    phase.advancementMethod === 'manual'
      ? t('Advances manually')
      : phase.advancementMethod === 'date'
        ? t('Advances by date')
        : null,
  ].filter(Boolean);

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
          {ruleParts.length > 0 ? (
            <span className="mt-0.5 block text-sm">
              {ruleParts.join(' · ')}
            </span>
          ) : null}
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

const ConfigurationCard = ({ config }: { config: AdminDecisionConfig }) => {
  const t = useTranslations();

  const settings: Array<{ label: string; value: string | boolean }> = [
    { label: t('Private process'), value: config.isPrivate },
    { label: t('Hide budget'), value: config.hideBudget },
    { label: t('Proposal template'), value: config.hasProposalTemplate },
    { label: t('Review rubric'), value: config.hasRubric },
    { label: t('Review revisions'), value: config.reviewsAllowRevisions },
    {
      label: t('Anonymous review feedback'),
      value: config.reviewsAnonymousFeedback,
    },
    {
      label: t('Require category selection'),
      value: config.requireCategorySelection,
    },
    {
      label: t('Allow multiple categories'),
      value: config.allowMultipleCategories,
    },
    { label: t('Organize by categories'), value: config.organizeByCategories },
    {
      label: t('Require collaborative proposals'),
      value: config.requireCollaborativeProposals,
    },
    { label: t('Categories'), value: String(config.categoriesCount) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Configuration')}</CardTitle>
        <CardDescription>
          {t('Process-level settings for this decision')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {settings.map((setting) => (
            <div
              key={setting.label}
              className="flex items-center justify-between gap-3 border-b pb-2"
            >
              <dt className="text-sm">{setting.label}</dt>
              <dd>
                {typeof setting.value === 'boolean' ? (
                  <Badge variant={setting.value ? 'default' : 'outline'}>
                    {setting.value ? t('On') : t('Off')}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {setting.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
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
