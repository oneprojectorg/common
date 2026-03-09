'use client';

import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
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

  const [[{ proposals }, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.listProposals({
      processInstanceId: instanceId,
      limit: 20,
    }),
    t.decision.getInstance({ instanceId }),
  ]);

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.instanceData?.currentPhaseId;
  const currentPhase = phases.find((phase) => phase.phaseId === currentPhaseId);

  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ??
      instance.instanceData?.templateDescription ??
      undefined);
  const aboutIsMarkup = !!instance?.description?.match('PPDESCRIPTION');

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4">
        <DecisionHero
          title={currentPhase?.headline ?? t('SHARE YOUR IDEAS.')}
          description={
            currentPhase?.description ? (
              <p>{currentPhase.description}</p>
            ) : undefined
          }
          variant="standard"
        />

        <MemberParticipationFacePile submitters={uniqueSubmitters} />

        <DecisionActionBar
          instanceId={instanceId}
          markup={currentPhase?.additionalInfo ? false : aboutIsMarkup}
          description={currentPhase?.additionalInfo ?? description}
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
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
