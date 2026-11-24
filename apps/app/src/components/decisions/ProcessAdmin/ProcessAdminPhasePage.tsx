'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { formatDateRange } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { Card } from '@op/sense/Card';
import { Empty, EmptyHeader, EmptyTitle } from '@op/sense/Empty';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { useLocale } from 'next-intl';
import { Suspense, type ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { ProcessAdminLoadError } from './ProcessAdminLoadError';

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
            <ProcessAdminLoadError />
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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-40" />
      </PhaseTitle>
      <PhaseColumns>
        <Skeleton className="h-96 min-w-0 flex-1 rounded-lg" />
        <PhaseSettingsColumn>
          <Skeleton className="h-40 rounded-lg" />
        </PhaseSettingsColumn>
      </PhaseColumns>
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
  const locale = useLocale();
  const t = useTranslations('decisions.processAdmin');
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });
  const phase = decisionProfile.processInstance.phases.find(
    (candidate) => candidate.slug === phaseSlug,
  );

  if (!phase) {
    return (
      <PhasePageFrame slug={slug}>
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyTitle>{t('phaseNotFound')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </PhasePageFrame>
    );
  }

  const dates = formatDateRange(phase.startDate, phase.endDate, locale);

  return (
    <PhasePageFrame slug={slug}>
      <PhaseTitle>
        <Header1>{phase.name}</Header1>
        {dates ? <p className="text-muted-foreground">{dates}</p> : null}
      </PhaseTitle>
      <PhaseColumns>
        <Card className="min-w-0 flex-1 shadow-none" />
        <PhaseSettingsColumn />
      </PhaseColumns>
    </PhasePageFrame>
  );
}

function PhasePageFrame({
  slug,
  children,
}: {
  /** Omitted while loading, when the route's params are not available yet. */
  slug?: string;
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

function PhaseSettingsColumn({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 md:w-73 md:shrink-0">
      {children}
    </div>
  );
}
