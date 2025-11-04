'use client';

import { formatCurrency } from '@/utils/formatting';
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

  const [[{ proposals }, instance, voteStatus]] = trpc.useSuspenseQueries(
    (t) => [
      t.decision.listProposals({
        processInstanceId: instanceId,
        limit: 20,
        status: 'approved',
      }),
      t.decision.getInstance({
        instanceId,
      }),
      t.decision.getVotingStatus({
        processInstanceId: instanceId,
      }),
    ],
  );

  const hasVoted = voteStatus?.hasVoted || false;
  const uniqueSubmitters = getUniqueSubmitters(proposals);

  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ?? instance.process?.description ?? undefined);
  const aboutIsMarkup = !!instance?.description?.match('PPDESCRIPTION');

  const maxVotesPerMember = instance?.instanceData?.fieldValues
    ?.maxVotesPerMember as number;
  const totalBudgetAmount = instance?.instanceData?.fieldValues
    ?.totalBudgetAmount as number;

  // Organization-specific content
  const heroContent = match(slug, {
    'people-powered': () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('TIME TO VOTE.'),
      description: (
        <>
          <p>
            {t('We are in the voting stage now!')}
            <br />
            {t(
              'We have at least {budget} to allocate for budget proposals for 2026! Read through the proposals below and in the ballot and voter guide, and you can also take a look at the full texts and discussions by clicking on each proposal. Selected proposals will be implemented in 2026. It will take around 10 minutes for you to participate.',
              {
                budget: totalBudgetAmount
                  ? formatCurrency(totalBudgetAmount)
                  : '$50,000 USD',
              },
            )}
          </p>
          <p>
            <strong>
              {t(
                'Click on "About the process" to learn more about the fund allocation.',
              )}
            </strong>
          </p>
          {maxVotesPerMember && (
            <p>
              {t('Please select {count} proposals.', {
                count: maxVotesPerMember,
              })}
            </p>
          )}
        </>
      ),
    }),
    cowop: () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('TIME TO VOTE.'),
      description: (
        <p>{t('Help determine how we invest our community budget.')}</p>
      ),
    }),
    'one-project': () => ({
      title: hasVoted ? t('YOUR BALLOT IS IN.') : t('COMMITTEE DELIBERATION.'),
      description: (
        <div className="flex flex-col gap-2">
          <p>
            {t(
              'The Horizon Fund Committee is deliberating based on their reviews and your votes. Results coming soon!',
            )}
          </p>
          <p>
            {t('Questions? Reach out to Meg')}{' '}
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
          <p>{t('Help determine how we invest our community budget.')}</p>
          {maxVotesPerMember && (
            <p>
              {t('Please select {count} proposals.', {
                count: maxVotesPerMember,
              })}
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
          markup={aboutIsMarkup}
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
