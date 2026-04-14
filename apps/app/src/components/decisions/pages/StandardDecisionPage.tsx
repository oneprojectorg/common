'use client';

import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { useDecisionTranslation } from '../DecisionTranslationContext';
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
    t.decision.getProposalSubmitters({ processInstanceId: instanceId }),
  ]);

  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === currentPhaseId,
  );
  const allowProposals = currentPhase?.rules?.proposals?.submit === true;
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

      <div className="mt-8 flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="lg:col-span-3">
            <Suspense fallback={<ProposalListSkeleton />}>
              <ProposalsList
                slug={slug}
                instanceId={instanceId}
                decisionSlug={decisionSlug}
                decisionProfileId={decisionProfileId}
                permissions={instance.access}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
