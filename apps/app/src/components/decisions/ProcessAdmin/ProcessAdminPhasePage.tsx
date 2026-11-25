'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { isolateBidi } from '@/utils/isolateBidi';
import { trpc } from '@op/api/client';
import type { DecisionPhase } from '@op/api/encoders';
import { MAX_PHASE_NAME_LENGTH } from '@op/common/client';
import { APP_NAME } from '@op/core';
import { Button } from '@op/sense/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { EditableText } from '@op/sense/EditableText';
import { Empty, EmptyHeader, EmptyTitle } from '@op/sense/Empty';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Suspense, type ReactNode, useEffect, useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { ProcessAdminLoadError } from './ProcessAdminLoadError';
import { PhaseWindowCard } from './ProcessAdminPhaseSettings';
import { getPhaseKind } from './phaseKind';
import { getProcessAdminStatus } from './processAdminStatus';
import { useSavePhase } from './useSavePhase';

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
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });
  const { phases, status, currentStateId } = decisionProfile.processInstance;
  const index = phases.findIndex((candidate) => candidate.slug === phaseSlug);
  const phase = phases[index];
  const isDraft = getProcessAdminStatus(status) === 'draft';

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
    <>
      <p role="status" className="sr-only">
        {phase ? null : t('phaseNotFound')}
      </p>
      {phase ? (
        <PhaseEditor
          key={phase.id ?? phase.phaseId}
          slug={slug}
          phase={phase}
          previousPhase={phases[index - 1]}
          isDraft={isDraft}
          isLocked={isPastPhase({ isDraft, currentStateId, phases, index })}
        />
      ) : (
        <PhasePageFrame slug={slug}>
          <Empty className="border-0" aria-hidden>
            <EmptyHeader>
              <EmptyTitle>{t('phaseNotFound')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </PhasePageFrame>
      )}
    </>
  );
}

function PhaseEditor({
  slug,
  phase,
  previousPhase,
  isDraft,
  isLocked,
}: {
  slug: string;
  phase: DecisionPhase;
  previousPhase: DecisionPhase | undefined;
  isDraft: boolean;
  isLocked: boolean;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();
  const kind = getPhaseKind(phase);
  const savePhase = useSavePhase(slug);
  const [draftName, setDraftName] = useState<string | null>(null);
  const savedName = phase.name ?? '';
  const name = draftName ?? savedName;
  const rowId = phase.id;
  const canEdit = !isLocked && rowId !== null;
  const isDirty = canEdit && name !== savedName;

  const save = () => {
    if (!rowId || !isDirty) {
      return;
    }
    savePhase.mutate(
      { phaseId: rowId, name },
      { onSuccess: () => setDraftName(null) },
    );
  };

  return (
    <PhasePageFrame
      slug={slug}
      action={
        <Button
          disabled={!isDirty}
          loading={savePhase.isPending}
          onClick={save}
        >
          {isDraft ? tShared('Save') : tShared('Update')}
        </Button>
      }
    >
      <PhaseTitle>
        <StatusBadge variant="inactive" icon={false}>
          {t(`phaseBadge${kind}`)}
        </StatusBadge>
        <EditableText
          as="h1"
          wrap
          value={name}
          label={t('phaseNameLabel')}
          editHint={t('editTitleHint')}
          doneLabel={tShared('Done')}
          maxLength={MAX_PHASE_NAME_LENGTH}
          disabled={!canEdit}
          iconClassName="size-5"
          className="font-serif text-display font-light"
          onCommit={setDraftName}
        />
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
    </PhasePageFrame>
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

function isPastPhase({
  isDraft,
  currentStateId,
  phases,
  index,
}: {
  isDraft: boolean;
  currentStateId: string | null | undefined;
  phases: DecisionPhase[];
  index: number;
}): boolean {
  if (isDraft || !currentStateId) {
    return false;
  }
  const currentIndex = phases.findIndex(
    (candidate) => candidate.phaseId === currentStateId,
  );
  // A current phase missing from the list locks every phase, as the server does.
  return currentIndex === -1 || index < currentIndex;
}
