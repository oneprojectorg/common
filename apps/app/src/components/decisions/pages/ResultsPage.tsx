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
  const heroContent = match(slug, {
    'people-powered': () => ({
      title: t('THE RESULTS ARE IN.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
    cowop: () => ({
      title: t('THE RESULTS ARE IN.'),
      description: `COWOP's Funds Oversight Committee has made final decisions on allocating our first $100,000!`,
      about: `
After careful deliberation and interviews with all proposal teams, COWOP proudly announces the final projects to be funded through our bottom-up budgeting process!  An &lt;a target=&quot;_blank&quot; rel=&quot;noopener noreferrer nofollow&quot; href=&quot;https://docs.google.com/document/d/1Vut_98L7WK2G9lJfF2fX2GG_gWQYpNpmnNRJLgAJUL4/edit?tab=t.jc1uksmlpuqv&quot;&gt;expert team&lt;/a&gt; reviewed 17 total proposals in line with our &lt;a target=&quot;_blank&quot; rel=&quot;noopener noreferrer nofollow&quot; href=&quot;https://docs.google.com/spreadsheets/d/1REwc6lk0ZC6CWfUjEbNVkDWZIG9j0-gZbLls5XsGu4k/edit&quot;&gt;funding rubric&lt;/a&gt; and has decided to fund nine of them, mostly close to the full amount requested.  Congrats to all who participated, and set the stage for allocating our remaining $100,000 next year!
  `,
    }),
    'one-project': () => ({
      title: t('THE RESULTS ARE IN.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
    _: () => ({
      title: t('THE RESULTS ARE IN.'),
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

          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ResultsStats instanceId={instanceId} />
          </Suspense>

          {slug === 'cowop' ? (
            <DecisionActionBar
              instanceId={instanceId}
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
                  404: (
                    <EmptyProposalsState>
                      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
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
