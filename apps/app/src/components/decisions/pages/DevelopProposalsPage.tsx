'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { ProcessInstance } from '@op/api/encoders';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import {
  DevelopProposalsListSkeleton,
  DevelopProposalsListSuspense,
} from '../DevelopProposals/DevelopProposalsList';
import { NoOriginsEmpty } from '../DevelopProposals/NoOriginsEmpty';
import { ProposalsLoadError } from '../ProposalsLoadError';

/**
 * The develop screen: what someone with develop access sees while a develop
 * phase is current and its inbound selection is still pending. Lists the
 * previous phase's proposals (the origins) so each can be prepared as an entry
 * of this phase, and the entries that exist so far.
 */
export function DevelopProposalsPage({
  instance,
}: {
  instance: ProcessInstance;
}) {
  const t = useTranslations('decisions');
  const phases = instance.instanceData?.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const currentPhase = phases[currentIndex];
  const previousPhase = currentIndex > 0 ? phases[currentIndex - 1] : null;

  const heroImagePath = instance.instanceData?.overview?.heroImage;

  return (
    <div className="min-h-full">
      <DecisionHeroBanner heroImagePath={heroImagePath}>
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pt-16 pb-8 md:pb-16">
          <DecisionHero
            title={currentPhase?.headline ?? t('developEntriesHeading')}
            description={<p>{t('develop.heroDescription')}</p>}
            showTranslateLink={false}
            hasImage={Boolean(heroImagePath)}
          />
        </div>
      </DecisionHeroBanner>

      <div className="flex w-full justify-center bg-background">
        <div className="w-full p-4 sm:p-8">
          <div className="mx-auto w-full max-w-page">
            {/* A develop phase that opens the process has nothing to develop
              from, so there is nothing to fetch. */}
            {previousPhase ? (
              <APIErrorBoundary
                fallbacks={{ default: () => <ProposalsLoadError /> }}
              >
                <Suspense fallback={<DevelopProposalsListSkeleton />}>
                  <DevelopProposalsListSuspense
                    instance={instance}
                    originPhaseId={previousPhase.phaseId}
                  />
                </Suspense>
              </APIErrorBoundary>
            ) : (
              <NoOriginsEmpty />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
