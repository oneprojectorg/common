'use client';

import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
import { useLocale } from 'next-intl';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
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
  const heroImagePath = instance.instanceData?.overview?.heroImage;
  const hasHeroImage = Boolean(heroImagePath);

  return (
    <div className="min-h-full">
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
            markup={!!translation?.additionalInfo}
            description={actionBarDescription}
            showSubmitButton={false}
          />
        </div>
      </DecisionHeroBanner>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full p-4 sm:p-8">
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
