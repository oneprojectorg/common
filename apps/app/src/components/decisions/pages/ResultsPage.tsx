'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import {
  DecisionResultsTabPanel,
  DecisionResultsTabs,
} from '../DecisionResultsTabs';
import { MyBallot, NoVoteFound } from '../MyBallot';
import { ProposalListSkeleton } from '../ProposalsList';
import { ResultsList } from '../ResultsList';
import { ResultsStats } from '../ResultsStats';

// Common instance fields used by ResultsPage
interface ResultsPageInstance {
  name: string;
  description: string | null;
  process?: {
    description: string | null;
  } | null;
}

function ResultsPageLegacy({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const [instance] = trpc.decision.getLegacyInstance.useSuspenseQuery({
    instanceId,
  });
  return (
    <ResultsPageContent
      instanceId={instanceId}
      slug={slug}
      instance={instance}
    />
  );
}

export function ResultsPage({
  instanceId,
  slug,
  useLegacy = false,
}: {
  instanceId: string;
  slug: string;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
}) {
  if (useLegacy) {
    return <ResultsPageLegacy instanceId={instanceId} slug={slug} />;
  }
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  return (
    <ResultsPageContent
      instanceId={instanceId}
      slug={slug}
      instance={instance}
    />
  );
}

function ResultsPageContent({
  instanceId,
  slug,
  instance,
}: {
  instanceId: string;
  slug: string;
  instance: ResultsPageInstance;
}) {
  const t = useTranslations();

  // Organization-specific content
  const heroContent = match<{
    title: string;
    description: string;
    about?: string;
  }>(slug, {
    'people-powered': () => ({
      title: t('The results are in.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
    cowop: () => ({
      title: t('The results are in.'),
      description: t('COWOPRESULTSHEADER'),
      about: t('COWOPRESULTSABOUT'),
    }),
    'one-project': () => ({
      title: t('The results are in.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
      about: t('HORIZONRESULTSABOUT'),
    }),
    _: () => ({
      title: t('The results are in.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
  });

  return (
    <>
      {/* Hero section - will be inside gradient from DecisionHeader */}
      <div className="px-4 py-8">
        <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4">
          <DecisionHero
            title={heroContent.title}
            description={heroContent.description}
            variant="results"
          />

          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <ResultsStats instanceId={instanceId} />
          </Suspense>

          {['cowop', 'one-project'].includes(slug) ? (
            <DecisionActionBar
              instanceId={instanceId}
              markup={true}
              description={
                heroContent.about ??
                instance.description ??
                instance.process?.description ??
                undefined
              }
            />
          ) : null}
        </div>
      </div>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl">
          <DecisionResultsTabs>
            <DecisionResultsTabPanel id="funded">
              <APIErrorBoundary
                fallbacks={{
                  404: () => (
                    <EmptyState icon={<LuLeaf className="size-6" />}>
                      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
                        {t('Results are still being processed.')}
                      </Header3>
                      <p className="text-base text-neutral-charcoal">
                        {t('Check back again shortly for the results.')}
                      </p>
                    </EmptyState>
                  ),
                }}
              >
                <div className="lg:col-span-3">
                  <Suspense fallback={<ProposalListSkeleton />}>
                    <ResultsList slug={slug} instanceId={instanceId} />
                  </Suspense>
                </div>
              </APIErrorBoundary>
            </DecisionResultsTabPanel>

            <DecisionResultsTabPanel id="ballot">
              <APIErrorBoundary
                fallbacks={{
                  default: () => <NoVoteFound />,
                }}
              >
                <div className="lg:col-span-3">
                  <Suspense fallback={<ProposalListSkeleton />}>
                    <MyBallot slug={slug} instanceId={instanceId} />
                  </Suspense>
                </div>
              </APIErrorBoundary>
            </DecisionResultsTabPanel>
          </DecisionResultsTabs>
        </div>
      </div>
    </>
  );
}
