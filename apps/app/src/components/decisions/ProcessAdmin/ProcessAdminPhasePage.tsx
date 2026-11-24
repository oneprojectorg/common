'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { formatDateRange } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { useLocale } from 'next-intl';
import { Suspense, type ReactNode } from 'react';
import { LuArrowLeft, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

/** One phase of a process, at /decisions/[slug]/manage/phase/[phaseId], where the phase's settings are edited. */
export function ProcessAdminPhasePage({
  slug,
  phaseSlug,
}: {
  slug: string;
  phaseSlug: string;
}) {
  const t = useTranslations('decisions');

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <PhasePageFrame slug={slug}>
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LuTriangleAlert className="size-6" aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t('overviewLoadError')}</EmptyTitle>
                <EmptyDescription>{t('refreshPageHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
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
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-40" />
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
  const dates = phase
    ? formatDateRange(phase.startDate, phase.endDate, locale)
    : '';

  return (
    <PhasePageFrame slug={slug}>
      {phase ? (
        <>
          <Header1>{phase.name}</Header1>
          {dates ? <p className="text-muted-foreground">{dates}</p> : null}
        </>
      ) : (
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyTitle>{t('phaseNotFound')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
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
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-accent">
        <div className="flex h-14 items-center px-4 md:px-6">
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
      <main className="mx-auto flex w-full max-w-272 flex-col gap-2 px-4 py-6 md:px-6 md:py-12">
        {children}
      </main>
    </div>
  );
}
