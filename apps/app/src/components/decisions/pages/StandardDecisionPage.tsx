'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Suspense } from 'react';
import { LuClock, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { HiddenProposalsBanner } from '../HiddenProposalsBanner';
import { ManualSelectionList } from '../ManualSelectionList';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { ProposalListSkeleton } from '../ProposalListSkeleton';
import { ProposalsList } from '../ProposalsList';

export function StandardDecisionPage({
  instanceId,
  slug,
  decisionSlug,
  decisionProfileId,
  pinOffset,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Decision profile ID for translating the decision content (phase titles, headline, descriptions) */
  decisionProfileId?: string | null;
  /** Sticky filter-bar pin offset, forwarded to ProposalsList. */
  pinOffset?: number;
}) {
  const t = useTranslations();
  const translation = useDecisionTranslation();

  const [[instance, { submitters, total }]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstance({ instanceId }),
    t.decision.listProposalSubmitters({ processInstanceId: instanceId }),
  ]);

  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhaseIndex = phases.findIndex(
    (phase) => phase.phaseId === currentPhaseId,
  );
  const currentPhase =
    currentPhaseIndex >= 0 ? phases[currentPhaseIndex] : undefined;
  const nextPhase =
    currentPhaseIndex >= 0 ? phases[currentPhaseIndex + 1] : undefined;
  const allowProposals = currentPhase?.rules?.proposals?.submit === true;
  const proposalsHidden =
    currentPhase?.rules?.proposals?.defaults?.hidden === true;
  const description =
    instance.description ?? instance.instanceData?.templateDescription;
  const canSubmitProposal = instance.access?.submitProposals ?? false;
  const isAdmin = Boolean(instance.access?.admin);
  // Non-admin landing on the last phase before the admin has confirmed
  // winners: show a results-pending notice instead of the open proposal list.
  const isAwaitingFinalResults =
    !instance.selectionsAreConfirmed &&
    !isAdmin &&
    isLastPhase(currentPhaseId, phases);

  const heroTitle =
    translation?.headline ?? currentPhase?.headline ?? t('Share your ideas.');
  const heroDescription =
    translation?.phaseDescription ?? currentPhase?.description;
  const actionBarDescription =
    translation?.additionalInfo ??
    currentPhase?.additionalInfo ??
    translation?.description ??
    description;
  const heroImagePath = instance.instanceData?.overview?.heroImage;
  const hasHeroImage = Boolean(heroImagePath);

  return (
    <div className="min-h-full bg-muted">
      <DecisionHeroBanner heroImagePath={heroImagePath}>
        <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4 pt-16 pb-8 md:pb-16">
          <DecisionHero
            title={heroTitle}
            description={heroDescription ? <p>{heroDescription}</p> : undefined}
            variant="standard"
            hasImage={hasHeroImage}
          />

          <MemberParticipationFacePile
            submitters={submitters}
            total={total}
            hasImage={hasHeroImage}
          />

          <DecisionActionBar
            instanceId={instanceId}
            description={actionBarDescription}
            markup={!!translation?.additionalInfo}
            showSubmitButton={allowProposals && canSubmitProposal}
          />
        </div>
      </DecisionHeroBanner>

      <div className="flex w-full flex-col items-center bg-white">
        {proposalsHidden && (
          <HiddenProposalsBanner
            nextPhaseName={nextPhase?.name}
            currentPhaseEndDate={currentPhase?.endDate}
          />
        )}
        <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
          {isAwaitingFinalResults ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LuClock className="size-6" />
                </EmptyMedia>
                <EmptyTitle className="font-light">
                  {t('Results pending')}
                </EmptyTitle>
                <EmptyDescription className="text-base text-foreground">
                  {t("Results for this process haven't been processed yet.")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : !instance.selectionsAreConfirmed && isAdmin && decisionSlug ? (
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <LuTriangleAlert className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle className="font-light">
                        {t("Couldn't load manual selection")}
                      </EmptyTitle>
                      <EmptyDescription className="text-base text-foreground">
                        {t('Refresh the page to try again.')}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ),
              }}
            >
              <Suspense fallback={null}>
                <ManualSelectionList
                  instanceId={instanceId}
                  decisionSlug={decisionSlug}
                  pinOffset={pinOffset}
                />
              </Suspense>
            </APIErrorBoundary>
          ) : (
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <LuTriangleAlert className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle className="font-light">
                        {t("Couldn't load proposals")}
                      </EmptyTitle>
                      <EmptyDescription className="text-base text-foreground">
                        {t('Refresh the page to try again.')}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ),
              }}
            >
              <Suspense fallback={<ProposalListSkeleton />}>
                <ProposalsList
                  slug={slug}
                  instanceId={instanceId}
                  decisionSlug={decisionSlug}
                  decisionProfileId={decisionProfileId}
                  permissions={instance.access}
                  proposalsHidden={proposalsHidden}
                  pinOffset={pinOffset}
                />
              </Suspense>
            </APIErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
