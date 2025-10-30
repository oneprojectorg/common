'use client';

import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { EmptyProposalsState } from '../EmptyProposalsState';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';
import { ProcessPhase } from '../types';

export function StandardDecisionPage({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const t = useTranslations();

  const [[{ proposals }, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.listProposals({
      processInstanceId: instanceId,
      limit: 20,
    }),
    t.decision.getInstance({
      instanceId,
    }),
  ]);

  const instanceData = instance.instanceData as any;
  const processSchema = instance.process?.processSchema as any;
  const templateStates: ProcessPhase[] = processSchema?.states || [];

  const currentStateId =
    instanceData?.currentStateId || instance.currentStateId;
  const currentState = templateStates.find(
    (state) => state.id === currentStateId,
  );

  const allowProposals = currentState?.config?.allowProposals !== false;
  const uniqueSubmitters = getUniqueSubmitters(proposals);

  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ?? instance.process?.description ?? undefined);

  const maxVotesPerMember = instance?.instanceData?.fieldValues
    ?.maxVotesPerMember as number;

  // Organization-specific content
  const heroContent = match(slug, {
    'people-powered': () => ({
      title: t(
        "Decide how to allocate part of People Powered's budget for 2026",
      ),
      description: (
        <div className="mt-4">
          <p>
            {t(
              'During 2023, People Powered members and staff co-created the strategic plan that guides our work from 2024 to 2026.',
            )}
          </p>
          <p>
            {t(
              "Now, you will decide how to allocate part of People Powered's 2026 budget, in order to advance our strategic plan and move us toward the future horizons of participatory democracy.",
            )}
          </p>
          <p>
            {t(
              'This is the idea collection phase! You can submit your ideas, even if they are not structured yet. We will have time to develop them in the next phase!',
            )}
          </p>
        </div>
      ),
    }),
    cowop: () => ({
      title: t('COWOPHEADER'),
      description: (
        <div className="mt-4">
          <p>
            <a
              href="https://docs.google.com/document/d/18RFVgnAnEawOb8vU8SU6s0zL9XTyTS7-Ju6TalWQMnA/edit?tab=t.0#heading=h.7vhwsm8mmlge"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal"
            >
              {t('Submit a Proposal Concept')}
            </a>
            : {t('COWOPSUBHEADER')}
          </p>
        </div>
      ),
    }),
    'one-project': () => ({
      title: match(currentState?.id, {
        review: () => t('TIME TO VOTE.'),
        _: () => t('SHARE YOUR IDEAS.'),
      }),
      description: (
        <div className="flex flex-col gap-2">
          <p>
            Step 1: Click "Read Full Proposal" to learn more about each. Anyone
            can leave comments or "like" a proposal.
          </p>
          <p>
            Step 2: Choose one person from your organization to cast your votes.
          </p>
          <p>
            Each organization gets 5 votes to identify the proposals they think
            would be most impactful and aligned with the goal of supporting
            and/or establishing mutual aid infrastructure for our ecosystems.
          </p>
          <p>
            Questions? Reach out to Meg{' '}
            <a
              className="hover:text-underline text-primary-teal"
              href="mailto:meg@oneproject.org"
            >
              meg@oneproject.org
            </a>
          </p>
          {currentState?.id === 'review' && maxVotesPerMember && (
            <p>
              Please select <strong>{maxVotesPerMember} proposals.</strong>
            </p>
          )}
        </div>
      ),
    }),
    _: () => ({
      title: t('SHARE YOUR IDEAS.'),
      description: <p>Help determine how we invest our community budget.</p>,
    }),
  });

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4">
        <DecisionHero
          title={heroContent.title}
          description={heroContent.description}
          variant="standard"
        />

        <MemberParticipationFacePile submitters={uniqueSubmitters} />

        <DecisionActionBar
          instanceId={instanceId}
          description={description}
          showSubmitButton={allowProposals}
        />
      </div>

      <div className="mt-8 flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="lg:col-span-3">
            {proposals.length === 0 ? (
              <EmptyProposalsState>
                <Header3 className="font-serif !text-title-base font-light text-neutral-black">
                  {t('No proposals yet')}
                </Header3>
                <p className="text-base text-neutral-charcoal">
                  {t('You could be the first one to submit a proposal')}
                </p>
              </EmptyProposalsState>
            ) : (
              <Suspense fallback={<ProposalListSkeleton />}>
                <ProposalsList slug={slug} instanceId={instanceId} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
