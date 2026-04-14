'use client';

import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';

export function VotingPage({
  instanceId,
  slug,
  decisionSlug,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
}) {
  const t = useTranslations();
  const translation = useDecisionTranslation();

  const [[{ proposals }, instance, voteStatus]] = trpc.useSuspenseQueries(
    (t) => [
      t.decision.listProposals({
        processInstanceId: instanceId,
        limit: 20,
      }),
      t.decision.getInstance({ instanceId }),
      t.decision.getVotingStatus({ processInstanceId: instanceId }),
    ],
  );

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhaseIndex = phases.findIndex(
    (p) => p.phaseId === currentPhaseId,
  );
  const currentPhase =
    currentPhaseIndex >= 0
      ? (phases[currentPhaseIndex] as InstancePhaseData)
      : undefined;
  const nextPhase =
    currentPhaseIndex >= 0
      ? (phases[currentPhaseIndex + 1] as InstancePhaseData | undefined)
      : undefined;

  const hasVoted = voteStatus.hasVoted;

  const description =
    instance.description ?? instance.instanceData?.templateDescription;

  const heroTitle = hasVoted
    ? t('YOUR BALLOT IS IN.')
    : (translation?.headline ??
      currentPhase?.headline ??
      t('SHARE YOUR IDEAS.'));

  const resultsDate = nextPhase?.startDate
    ? new Date(nextPhase.startDate).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
      })
    : undefined;

  const heroDescription = hasVoted
    ? resultsDate
      ? t('Results will be shared on {date}.', { date: resultsDate })
      : undefined
    : (translation?.phaseDescription ?? currentPhase?.description);

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

        <MemberParticipationFacePile submitters={uniqueSubmitters} />

        <DecisionActionBar
          instanceId={instanceId}
          markup={!!translation?.additionalInfo}
          description={actionBarDescription}
          showSubmitButton={false}
        />
      </div>

      <div className="mt-8 flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="lg:col-span-3">
            <Suspense fallback={<ProposalListSkeleton />}>
              <ProposalsList
                slug={slug}
                instanceId={instanceId}
                decisionSlug={decisionSlug}
                permissions={instance.access}
                isVotingPhase
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
