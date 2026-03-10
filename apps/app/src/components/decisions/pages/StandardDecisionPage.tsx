'use client';

import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';

export function StandardDecisionPage({
  instanceId,
  slug,
  decisionSlug,
  allowProposals,
  description,
  currentPhase,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Whether proposal submission is allowed in the current phase */
  allowProposals: boolean;
  /** Instance-level description — fallback for the About the process modal */
  description?: string;
  /** Current phase data from the process builder */
  currentPhase?: InstancePhaseData;
}) {
  const t = useTranslations();

  const [{ proposals }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    limit: 20,
  });

  const uniqueSubmitters = getUniqueSubmitters(proposals);

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
          description={currentPhase?.additionalInfo ?? description}
          showSubmitButton={allowProposals}
        />
      </div>

      <div className="mt-8 flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="lg:col-span-3">
            {proposals.length === 0 ? (
              <EmptyState icon={<LuLeaf className="size-6" />}>
                <Header3 className="font-serif !text-title-base font-light text-neutral-black">
                  {t('No proposals yet')}
                </Header3>
                <p className="text-base text-neutral-charcoal">
                  {t('You could be the first one to submit a proposal')}
                </p>
              </EmptyState>
            ) : (
              <Suspense fallback={<ProposalListSkeleton />}>
                <ProposalsList
                  slug={slug}
                  instanceId={instanceId}
                  decisionSlug={decisionSlug}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
