'use client';

import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
import { useLocale } from 'next-intl';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { PhaseHeroBanner } from '../PhaseHeroBanner';
import { ProposalListSkeleton } from '../ProposalListSkeleton';
import { ProposalsList } from '../ProposalsList';

export function VotingPage({
  instanceId,
  slug,
  decisionSlug,
  pinOffset,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Sticky filter-bar pin offset, forwarded to ProposalsList. */
  pinOffset?: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const translation = useDecisionTranslation();

  const [[instance, voteStatus, { submitters, total }]] =
    trpc.useSuspenseQueries((t) => [
      t.decision.getInstance({ instanceId }),
      t.decision.getVotingStatus({ processInstanceId: instanceId }),
      t.decision.listProposalSubmitters({ processInstanceId: instanceId }),
    ]);

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
    : (translation?.headline ?? currentPhase?.headline ?? t('TIME TO VOTE.'));

  const resultsDate = nextPhase?.startDate
    ? new Date(nextPhase.startDate).toLocaleDateString(locale, {
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
  const isAdmin = Boolean(instance.access?.admin);

  return (
    <div className="min-h-full">
      <PhaseHeroBanner
        instanceId={instanceId}
        phase={currentPhase}
        overviewImagePath={instance.instanceData?.overview?.heroImage}
        isAdmin={isAdmin}
      >
        {(hasImage) => (
          <>
            <DecisionHero
              title={heroTitle}
              description={
                heroDescription ? <p>{heroDescription}</p> : undefined
              }
              variant="standard"
              hasImage={hasImage}
            />

            <MemberParticipationFacePile
              submitters={submitters}
              total={total}
              hasImage={hasImage}
            />

            <DecisionActionBar
              instanceId={instanceId}
              markup={!!translation?.additionalInfo}
              description={actionBarDescription}
              showSubmitButton={false}
            />
          </>
        )}
      </PhaseHeroBanner>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full p-4 sm:max-w-6xl sm:p-8">
          <Suspense fallback={<ProposalListSkeleton />}>
            <ProposalsList
              slug={slug}
              instanceId={instanceId}
              decisionSlug={decisionSlug}
              permissions={instance.access}
              currentPhase={currentPhase}
              pinOffset={pinOffset}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
