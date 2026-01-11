'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import {
  DecisionResultsTabPanel,
  DecisionResultsTabs,
} from '../DecisionResultsTabs';
import { EmptyProposalsState } from '../EmptyProposalsState';
import { MyBallot, NoVoteFound } from '../MyBallot';
import { ProposalListSkeleton } from '../ProposalsList';
import { ResultsList } from '../ResultsList';
import { ResultsStats } from '../ResultsStats';

export function ResultsPage({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const t = useTranslations();

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId,
  });

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
        <div className="max-w-3xl gap-4 mx-auto flex flex-col justify-center">
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

      <div className="flex w-full justify-center border-t border-neutral-gray1 bg-white">
        <div className="gap-8 p-4 sm:max-w-6xl w-full">
          <DecisionResultsTabs>
            <DecisionResultsTabPanel id="funded">
              <APIErrorBoundary
                fallbacks={{
                  404: (
                    <EmptyProposalsState>
                      <Header3 className="font-light font-serif !text-title-base text-neutral-black">
                        {t('Results are still being processed.')}
                      </Header3>
                      <p className="text-base text-neutral-charcoal">
                        {t('Check back again shortly for the results.')}
                      </p>
                    </EmptyProposalsState>
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
                  default: <NoVoteFound />,
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
