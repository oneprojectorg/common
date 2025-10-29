'use client';

import { useUser } from '@/utils/UserProvider';
import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { ProposalListSkeleton, ProposalsList } from '../ProposalsList';

export function VotingPage({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const t = useTranslations();
  const { user } = useUser();

  const [[{ proposals }, instance, voteStatus]] = trpc.useSuspenseQueries(
    (t) => [
      t.decision.listProposals({
        processInstanceId: instanceId,
        limit: 20,
      }),
      t.decision.getInstance({
        instanceId,
      }),
      t.decision.getVotingStatus({
        processInstanceId: instanceId,
        userId: user?.id || '',
      }),
    ],
  );

  const hasVoted = voteStatus?.hasVoted || false;
  const uniqueSubmitters = getUniqueSubmitters(proposals);

  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ?? instance.process?.description ?? undefined);

  const maxVotesPerMember = instance?.instanceData?.fieldValues
    ?.maxVotesPerMember as number;

  // Organization-specific content
  const heroContent = match(slug, {
    'people-powered': () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('TIME TO VOTE.'),
      description: <p>Help determine how we invest our community budget.</p>,
    }),
    cowop: () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('TIME TO VOTE.'),
      description: <p>Help determine how we invest our community budget.</p>,
    }),
    'one-project': () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('COMMITTEE DELIBERATION.'),
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
        </div>
      ),
    }),
    _: () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('TIME TO VOTE.'),
      description: (
        <>
          <p>Help determine how we invest our community budget.</p>
          {maxVotesPerMember && (
            <p>
              Please select <strong>{maxVotesPerMember} proposals.</strong>
            </p>
          )}
        </>
      ),
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
          showSubmitButton={false}
        />
      </div>

      <div className="mt-8 flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="lg:col-span-3">
            <Suspense fallback={<ProposalListSkeleton />}>
              <ProposalsList slug={slug} instanceId={instanceId} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
