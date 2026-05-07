import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api';
import { type InstancePhaseData } from '@op/api/encoders';
import { ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

import { AdminPhaseProposalsList } from '../AdminPhaseProposalsList';
import { DecisionHero } from '../DecisionHero';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';
import { ReviewProgressBanner, ReviewProgressBannerSkeleton } from '../Review';
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

  // Profile admins already get review=true via ALL_TRUE_ACCESS in getInstance.
  // Decisions-zone admins ("Manage Process") without explicit review
  // permission see all phase proposals + reviewer aggregates instead of an
  // assignments list (which would be empty).
  const canReview = Boolean(instance.access?.review);
  const isAdmin = Boolean(instance.access?.admin);

  return (
    <div className="min-h-full">
      {isAdmin ? (
        <div className="flex w-full justify-center border-b bg-neutral-offWhite px-4">
          <APIErrorBoundary fallbacks={{ default: () => null }}>
            <Suspense fallback={<ReviewProgressBannerSkeleton />}>
              <ReviewProgressBanner processInstanceId={instance.id} />
            </Suspense>
          </APIErrorBoundary>
        </div>
      ) : (
        <div className="pt-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
            <DecisionHero
              title={
                currentPhase.headline ?? (
                  <TranslatedText text="REVIEW PROPOSALS." />
                )
              }
              description={
                currentPhase.description ? (
                  <p>{currentPhase.description}</p>
                ) : undefined
              }
              variant="standard"
            >
              <div className="flex justify-center pt-2">
                <ButtonLink color="secondary" size="medium" href="#">
                  <TranslatedText text="Learn more" />
                </ButtonLink>
              </div>
            </DecisionHero>
          </div>
        </div>
      )}

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
              ) : isAdmin ? (
                <AdminPhaseProposalsList
                  processInstanceId={instance.id}
                  phaseId={currentPhaseId ?? undefined}
                  decisionSlug={decisionSlug}
                />
              ) : (
                <ProposalsList
                  slug={slug}
                  instanceId={instance.id}
                  decisionSlug={decisionSlug}
                  decisionProfileId={decisionProfileId}
                  permissions={instance.access}
                />
              )}
            </Suspense>
          </APIErrorBoundary>
        </div>
      </div>
    </div>
  );
}
