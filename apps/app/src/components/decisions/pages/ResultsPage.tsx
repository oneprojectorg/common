'use client';

import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import {
  DecisionResultsTabPanel,
  DecisionResultsTabs,
} from '../DecisionResultsTabs';
import { MyBallot } from '../MyBallot';
import { ProposalListSkeleton } from '../ProposalsList';
import { ResultsList } from '../ResultsList';

export function ResultsPage({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const t = useTranslations();

  const [[instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstance({
      instanceId,
    }),
  ]);

  // Get description for "About the process" button
  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ?? instance.process?.description ?? undefined);

  // Organization-specific content
  const heroContent = match(slug, {
    'people-powered': () => ({
      title: t('THE RESULTS ARE IN.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
    cowop: () => ({
      title: t('THE RESULTS ARE IN.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
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

          <DecisionActionBar
            instanceId={instanceId}
            description={description}
            showSubmitButton={false}
          />
        </div>
      </div>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <DecisionResultsTabs>
            <DecisionResultsTabPanel id="funded">
              <div className="lg:col-span-3">
                <Suspense fallback={<ProposalListSkeleton />}>
                  <ResultsList slug={slug} instanceId={instanceId} />
                </Suspense>
              </div>
            </DecisionResultsTabPanel>

            <DecisionResultsTabPanel id="ballot">
              <div className="lg:col-span-3">
                <Suspense fallback={<ProposalListSkeleton />}>
                  <MyBallot slug={slug} instanceId={instanceId} />
                </Suspense>
              </div>
            </DecisionResultsTabPanel>
          </DecisionResultsTabs>
        </div>
      </div>
    </>
  );
}
