'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { EmptyState } from '@op/ui-next/EmptyState';
import { Header3 } from '@op/ui-next/Header';
import { Suspense } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { HiddenProposalsBanner } from '../HiddenProposalsBanner';
import { ManualSelectionList } from '../ManualSelectionList';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';

export function StandardDecisionPage({
  instanceId,
  slug,
  decisionSlug,
  decisionProfileId,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Decision profile ID for translating the decision content (phase titles, headline, descriptions) */
  decisionProfileId?: string | null;
}) {
  const t = useTranslations();
  const translation = useDecisionTranslation();

  const [[instance, { submitters }]] = trpc.useSuspenseQueries((t) => [
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

  const heroTitle =
    translation?.headline ?? currentPhase?.headline ?? t('SHARE YOUR IDEAS.');
  const heroDescription =
    translation?.phaseDescription ?? currentPhase?.description;
  const actionBarDescription =
    translation?.additionalInfo ??
    currentPhase?.additionalInfo ??
    translation?.description ??
    description;

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4">
        <DecisionHero
          title={heroTitle}
          description={heroDescription ? <p>{heroDescription}</p> : undefined}
          variant="standard"
        />

        <MemberParticipationFacePile submitters={submitters} />

        <DecisionActionBar
          instanceId={instanceId}
          description={actionBarDescription}
          markup={!!translation?.additionalInfo}
          showSubmitButton={allowProposals && canSubmitProposal}
        />
      </div>

      <div className="mt-8 flex w-full flex-col items-center border-t bg-white">
        {proposalsHidden && (
          <HiddenProposalsBanner
            nextPhaseName={nextPhase?.name}
            currentPhaseEndDate={currentPhase?.endDate}
          />
        )}
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="flex flex-col gap-6 lg:col-span-3">
            {!instance.selectionsAreConfirmed &&
            instance.access?.admin &&
            decisionSlug ? (
              <APIErrorBoundary
                fallbacks={{
                  default: () => (
                    <EmptyState icon={<LuTriangleAlert className="size-6" />}>
                      <Header3 className="font-serif font-light">
                        {t("Couldn't load manual selection")}
                      </Header3>
                      <p className="text-base text-neutral-charcoal">
                        {t('Refresh the page to try again.')}
                      </p>
                    </EmptyState>
                  ),
                }}
              >
                <Suspense fallback={null}>
                  <ManualSelectionList
                    instanceId={instanceId}
                    decisionSlug={decisionSlug}
                  />
                </Suspense>
              </APIErrorBoundary>
            ) : (
              <APIErrorBoundary
                fallbacks={{
                  default: () => (
                    <EmptyState icon={<LuTriangleAlert className="size-6" />}>
                      <Header3 className="font-serif font-light">
                        {t("Couldn't load proposals")}
                      </Header3>
                      <p className="text-base text-neutral-charcoal">
                        {t('Refresh the page to try again.')}
                      </p>
                    </EmptyState>
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
                  />
                </Suspense>
              </APIErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
