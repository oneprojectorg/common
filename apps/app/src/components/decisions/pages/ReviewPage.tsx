'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
import { ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionHero } from '../DecisionHero';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';
import { ReviewAssignmentsList } from '../ReviewAssignmentsList';

export function ReviewPage({
  instanceId,
  decisionSlug,
  slug,
  decisionProfileId,
}: {
  instanceId: string;
  decisionSlug: string;
  slug: string;
  decisionProfileId?: string | null;
}) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === currentPhaseId,
  );

  if (!currentPhase) {
    throw new Error(`Phase "${currentPhaseId}" not found in instance phases`);
  }

  // Profile admins already get review=true via ALL_TRUE_ACCESS in getInstance,
  // so this gate covers them too. Decisions-zone admins ("Manage Process")
  // without explicit review permission fall through to the proposals grid —
  // they can't actually submit reviews, so the assignments list would be empty.
  const canReview = instance.access?.review ?? false;

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={
            currentPhase.headline ?? <TranslatedText text="REVIEW PROPOSALS." />
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

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          {canReview ? (
            <ReviewAssignmentsList
              processInstanceId={instanceId}
              decisionSlug={decisionSlug}
            />
          ) : (
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <EmptyState icon={<LuLeaf className="size-6" />}>
                    <Header3 className="font-serif !text-title-base font-light text-neutral-black">
                      {t("We couldn't load proposals")}
                    </Header3>
                    <p className="text-base text-neutral-charcoal">
                      {t('Please refresh the page to try again.')}
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
                  isReviewPhase
                />
              </Suspense>
            </APIErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
