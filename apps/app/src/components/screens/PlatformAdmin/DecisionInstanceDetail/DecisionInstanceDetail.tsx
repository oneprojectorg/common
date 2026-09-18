'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionConfig,
  AdminDecisionPhase,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button, buttonVariants } from '@op/sense/Button';
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
import { toast } from '@op/sense/Toast';
import { useFormatter } from 'next-intl';
import { Suspense, useState } from 'react';
import { LuArrowLeft, LuArrowUpRight, LuCheck, LuCopy } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { RevertPhaseButton } from './RevertPhaseButton';
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
          {t('admin.allDecisionsTitle')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-headline font-light">{detail.name}</h1>
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
              {t('admin.viewDecisionAction')}
              <LuArrowUpRight
                data-icon="inline-end"
                className="rtl:-scale-x-100"
              />
            </Link>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-2">
          <MetaItem
            label={t('admin.ownerLabel')}
            value={detail.owner?.name ?? '—'}
          />
          <MetaItem
            label={t('admin.stewardLabel')}
            value={detail.steward?.name ?? '—'}
          />
          <MetaItem
            label={t('admin.processTypeLabel')}
            value={
              detail.processType
                ? detail.templateVersion
                  ? `${detail.processType} (v${detail.templateVersion})`
                  : detail.processType
                : '—'
            }
          />
          <MetaItem
            label={t('admin.reviewsPolicyLabel')}
            value={detail.reviewsPolicy?.replaceAll('_', ' ') ?? '—'}
          />
          <MetaItem
            label={t('admin.createdLabel')}
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
          <TabsTrigger value="configuration">
            {t('admin.configurationHeading')}
          </TabsTrigger>
          <TabsTrigger value="members">{t('profile.membersTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="phases" className="flex flex-col gap-6 pt-4">
          {detail.phases.map((phase, index) => (
            <PhaseCard
              key={phase.phaseId}
              instanceId={instanceId}
              phase={phase}
              previousPhase={detail.phases[index - 1]}
              index={index}
              total={detail.phases.length}
              currentIndex={detail.phases.findIndex((p) => p.isCurrent)}
            />
          ))}
        </TabsContent>
        <TabsContent value="configuration" className="pt-4">
          <ConfigurationCard
            config={detail.config}
            instanceData={detail.instanceData}
          />
        </TabsContent>
        <TabsContent value="members" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.membersTab')}</CardTitle>
              <CardDescription>{t('admin.membersSectionHint')}</CardDescription>
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
  previousPhase,
  index,
  total,
  currentIndex,
}: {
  instanceId: string;
  phase: AdminDecisionPhase;
  /** The phase before this one, undefined for the first phase. */
  previousPhase: AdminDecisionPhase | undefined;
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
      ? t('admin.dateRange', { start: startDate, end: endDate })
      : (startDate ?? endDate);

  const hasAnySection =
    phase.hasProposals || phase.hasReviews || phase.hasVoting;
  const isCompleted = currentIndex >= 0 && index < currentIndex;

  const ruleParts = [
    phase.hasProposals &&
      (phase.proposalsHiddenByDefault
        ? t('admin.proposalSubmissionsHidden')
        : t('admin.proposalSubmissionsLabel')),
    phase.canEditProposals && t('Proposal editing'),
    phase.hasReviews && t('Reviews'),
    phase.hasVoting &&
      (phase.maxVotesPerMember != null
        ? t('admin.votingWithMax', {
            count: phase.maxVotesPerMember,
          })
        : t('Voting')),
    phase.canEditVotes && t('admin.voteEditingLabel'),
    // Only the exception is worth a row: comments are on unless turned off.
    !phase.allowsComments && t('admin.commentsOffLabel'),
    phase.advancementMethod === 'manual'
      ? t('admin.advancesManually')
      : phase.advancementMethod === 'date'
        ? t('admin.advancesByDate')
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
          {phase.name ?? t('admin.phaseNumber', { number: index + 1 })}
        </CardTitle>
        <CardDescription>
          {t('admin.phaseNumberOfTotal', { number: index + 1, total })}
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
              <Badge>{t('admin.currentPhaseLabel')}</Badge>
            ) : index < currentIndex ? (
              <Badge variant="secondary">{t('Completed')}</Badge>
            ) : (
              <Badge variant="outline">{t('admin.upcomingLabel')}</Badge>
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
            {t('admin.nothingToManage')}
          </p>
        ) : null}
        {phase.isCurrent && previousPhase ? (
          <PhaseSection title={t('admin.dangerZoneHeading')}>
            <div className="w-fit">
              <RevertPhaseButton
                instanceId={instanceId}
                phaseId={phase.phaseId}
                previousPhaseName={
                  previousPhase.name ??
                  t('admin.phaseNumber', { number: index })
                }
              />
            </div>
          </PhaseSection>
        ) : null}
      </CardContent>
    </Card>
  );
};

const ConfigurationCard = ({
  config,
  instanceData,
}: {
  config: AdminDecisionConfig;
  instanceData: unknown;
}) => {
  const t = useTranslations();
  const [isRawShown, setIsRawShown] = useState(false);
  const rawConfig = JSON.stringify(instanceData, null, 2);

  const settings: Array<{ label: string; value: string | boolean }> = [
    { label: t('admin.privateProcessLabel'), value: config.isPrivate },
    { label: t('admin.hideBudgetLabel'), value: config.hideBudget },
    { label: t('Proposal template'), value: config.hasProposalTemplate },
    { label: t('admin.reviewRubricLabel'), value: config.hasRubric },
    {
      label: t('admin.reviewRevisionsLabel'),
      value: config.reviewsAllowRevisions,
    },
    {
      label: t('admin.anonymousReviewFeedbackLabel'),
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
    {
      label: t('admin.organizeByCategoriesLabel'),
      value: config.organizeByCategories,
    },
    {
      label: t('Require collaborative proposals'),
      value: config.requireCollaborativeProposals,
    },
    { label: t('Categories'), value: String(config.categoriesCount) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.configurationHeading')}</CardTitle>
        <CardDescription>{t('admin.configurationHint')}</CardDescription>
        <CardAction className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={isRawShown}
            aria-controls="raw-config"
            onClick={() => setIsRawShown((shown) => !shown)}
          >
            {isRawShown
              ? t('admin.hideRawConfigAction')
              : t('admin.viewRawConfigAction')}
          </Button>
          <CopyRawConfigButton value={rawConfig} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
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
                    {setting.value ? t('admin.toggleOn') : t('admin.toggleOff')}
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
        {isRawShown ? (
          <pre
            id="raw-config"
            className="max-h-[60vh] overflow-y-auto rounded-lg bg-muted p-4 text-xs break-words whitespace-pre-wrap"
          >
            {rawConfig}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
};

const CopyRawConfigButton = ({ value }: { value: string }) => {
  const t = useTranslations();
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setHasCopied(true);
      toast.success(t('admin.rawConfigCopied'));
      // Revert the icon so a second copy still reads as a fresh action
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error(t('admin.copyError'));
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {hasCopied ? <LuCheck /> : <LuCopy />}
      {t('Copy')}
    </Button>
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
      {t('admin.comingSoonLabel')}
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
