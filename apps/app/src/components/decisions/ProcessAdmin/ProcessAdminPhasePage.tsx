'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { isolateBidi } from '@/utils/isolateBidi';
import { trpc } from '@op/api/client';
import type { DecisionPhase } from '@op/api/encoders';
import { APP_NAME } from '@op/core';
import { Button } from '@op/sense/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { Empty, EmptyHeader, EmptyTitle } from '@op/sense/Empty';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Suspense, type ReactNode, useEffect } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { ProcessAdminLoadError } from './ProcessAdminLoadError';
import { PhaseWindowCard } from './ProcessAdminPhaseSettings';
import { getPhaseKind } from './phaseKind';
import { getProcessAdminStatus } from './processAdminStatus';

export function ProcessAdminPhasePage({
  slug,
  phaseSlug,
}: {
  slug: string;
  phaseSlug: string;
}) {
  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <PhasePageFrame slug={slug}>
            <ProcessAdminLoadError subject="phase" />
          </PhasePageFrame>
        ),
      }}
    >
      <Suspense fallback={<ProcessAdminPhasePageSkeleton />}>
        <ProcessAdminPhasePageSuspense slug={slug} phaseSlug={phaseSlug} />
      </Suspense>
    </APIErrorBoundary>
  );
}

export function ProcessAdminPhasePageSkeleton() {
  return (
    <PhasePageFrame>
      <PhaseTitle>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-10 w-64" />
      </PhaseTitle>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <PhaseColumns>
          <Skeleton className="h-96 min-w-0 flex-1 rounded-lg" />
          <PhaseSettingsColumn>
            <Skeleton className="h-40 rounded-lg" />
          </PhaseSettingsColumn>
        </PhaseColumns>
      </div>
    </PhasePageFrame>
  );
}

function ProcessAdminPhasePageSuspense({
  slug,
  phaseSlug,
}: {
  slug: string;
  phaseSlug: string;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });
  const { phases, status } = decisionProfile.processInstance;
  const index = phases.findIndex((candidate) => candidate.slug === phaseSlug);
  const phase = phases[index];

  const phaseName = phase?.name ?? '';
  const decisionName = decisionProfile.name;

  useEffect(() => {
    const title = t('phasePageTitle', {
      phaseName: isolateBidi(phaseName),
      decisionName: isolateBidi(decisionName),
    });
    document.title = `${title} | ${APP_NAME}`;
  }, [t, phaseName, decisionName]);

  return (
    <PhasePageFrame
      slug={slug}
      action={
        phase ? (
          <Button disabled>
            {getProcessAdminStatus(status) === 'draft'
              ? tShared('Save')
              : tShared('Update')}
          </Button>
        ) : undefined
      }
    >
      <p role="status" className="sr-only">
        {phase ? null : t('phaseNotFound')}
      </p>
      {phase ? (
        <PhaseEditor phase={phase} previousPhase={phases[index - 1]} />
      ) : (
        <Empty className="border-0" aria-hidden>
          <EmptyHeader>
            <EmptyTitle>{t('phaseNotFound')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </PhasePageFrame>
  );
}

function PhaseEditor({
  phase,
  previousPhase,
}: {
  phase: DecisionPhase;
  previousPhase: DecisionPhase | undefined;
}) {
  const t = useTranslations('decisions.processAdmin');
  const kind = getPhaseKind(phase);

  return (
    <>
      <PhaseTitle>
        <StatusBadge variant="inactive" icon={false}>
          {t(`phaseBadge${kind}`)}
        </StatusBadge>
        <Header1>{phase.name}</Header1>
      </PhaseTitle>
      <Tabs defaultValue="setup" className="flex flex-col gap-6">
        <TabsList variant="line">
          <TabsTrigger value="setup">{t(`phaseSetupTab${kind}`)}</TabsTrigger>
          <TabsTrigger value="people">{t(`phasePeopleTab${kind}`)}</TabsTrigger>
        </TabsList>
        <PhaseColumns>
          <TabsContent value="setup" className="min-w-0 flex-1">
            <PhaseSectionCard
              title={t(`phaseBodyTitle${kind}`)}
              description={t(`phaseBodyDescription${kind}`)}
            />
          </TabsContent>
          <TabsContent value="people" className="min-w-0 flex-1">
            <PhaseSectionCard title={t(`phasePeopleTab${kind}`)} />
          </TabsContent>
          <PhaseSettingsColumn>
            <PhaseWindowCard
              phase={phase}
              kind={kind}
              previousPhase={previousPhase}
            />
          </PhaseSettingsColumn>
        </PhaseColumns>
      </Tabs>
    </>
  );
}

function PhaseSectionCard({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const t = useTranslations('decisions.processAdmin');

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{t('phaseComingSoon')}</p>
      </CardContent>
    </Card>
  );
}

function PhasePageFrame({
  slug,
  action,
  children,
}: {
  /** Omitted while loading, when the route's params are not available yet. */
  slug?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const tShared = useTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <header className="sticky top-0 z-30 shrink-0 border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          {slug ? (
            <ButtonLink href={`/decisions/${slug}/manage`} variant="link">
              <LuArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
              {tShared('Back')}
            </ButtonLink>
          ) : (
            <Skeleton className="h-5 w-16" />
          )}
          {action}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-272 flex-col gap-10 px-4 py-10 md:px-6">
        {children}
      </main>
    </div>
  );
}

function PhaseTitle({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-start gap-2">{children}</div>;
}

function PhaseColumns({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
      {children}
    </div>
  );
}

function PhaseSettingsColumn({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 md:w-73 md:shrink-0">
      {children}
    </div>
  );
}
