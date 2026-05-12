'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api';
import { type InstancePhaseData } from '@op/api/encoders';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';
import { ReviewProgressStats } from '../Review/ReviewProgressStats';
import { ReviewAssignmentsList } from '../ReviewAssignmentsList';

type Instance = RouterOutput['decision']['getInstance'];

export function ReviewPage({
  instance,
  decisionSlug,
  slug,
  decisionProfileId,
}: {
  instance: Instance;
  decisionSlug: string;
  slug: string;
  decisionProfileId?: string | null;
}) {
  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === currentPhaseId,
  );

  if (!currentPhase) {
    throw new Error(`Phase "${currentPhaseId}" not found in instance phases`);
  }

  const canReview = Boolean(instance.access?.review);
  const isAdmin = Boolean(instance.access?.admin);

  const translation = useDecisionTranslation();
  const description =
    instance.description ?? instance.instanceData?.templateDescription;
  const actionBarDescription =
    translation?.additionalInfo ??
    currentPhase.additionalInfo ??
    translation?.description ??
    description;

  return (
    <div className="min-h-full">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 py-8">
        <DecisionHero
          title={
            isAdmin ? (
              <TranslatedText text="Review Progress" />
            ) : (
              (currentPhase.headline ?? (
                <TranslatedText text="REVIEW PROPOSALS." />
              ))
            )
          }
          description={
            !isAdmin && currentPhase.description ? (
              <p>{currentPhase.description}</p>
            ) : undefined
          }
          variant="standard"
        >
          {isAdmin ? (
            <ReviewProgressStats
              processInstanceId={instance.id}
              phaseId={currentPhase.phaseId}
            />
          ) : (
            <DecisionActionBar
              instanceId={instance.id}
              description={actionBarDescription}
              markup={!!translation?.additionalInfo}
              showSubmitButton={false}
            />
          )}
        </DecisionHero>
      </div>

      <div className="flex w-full justify-center bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <APIErrorBoundary
            fallbacks={{
              default: () => (
                <EmptyState icon={<LuLeaf className="size-6" />}>
                  <Header3 className="font-serif !text-title-base font-light text-neutral-black">
                    <TranslatedText text="We couldn't load proposals" />
                  </Header3>
                  <p className="text-base text-neutral-charcoal">
                    <TranslatedText text="Please refresh the page to try again." />
                  </p>
                </EmptyState>
              ),
            }}
          >
            <Suspense fallback={<ProposalListSkeleton />}>
              {canReview ? (
                <ReviewAssignmentsList
                  processInstanceId={instance.id}
                  decisionSlug={decisionSlug}
                  canViewReviewers={isAdmin}
                />
              ) : (
                <ProposalsList
                  slug={slug}
                  instanceId={instance.id}
                  decisionSlug={decisionSlug}
                  decisionProfileId={decisionProfileId}
                  permissions={instance.access}
                  currentPhase={currentPhase}
                />
              )}
            </Suspense>
          </APIErrorBoundary>
        </div>
      </div>
    </div>
  );
}
