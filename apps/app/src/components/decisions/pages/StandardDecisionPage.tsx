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

export function StandardDecisionPage({
  instanceId,
  slug,
  allowProposals,
  description,
  currentPhaseId,
  maxVotesPerMember,
}: {
  instanceId: string;
  slug: string;
  /** Whether proposal submission is allowed in the current phase */
  allowProposals: boolean;
  /** Description to show in the action bar */
  description?: string;
  /** Current phase ID - used for slug-specific hero content */
  currentPhaseId?: string;
  /** Max votes per member - used for one-project specific content */
  maxVotesPerMember?: number;
}) {
  const t = useTranslations();

  const [{ proposals }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    limit: 20,
  });

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  // Organization-specific content
  const heroContent = match(slug, {
    'people-powered': () => ({
      title: t('SUMMARY OF RESULTS'),
      description: (
        <div className="mt-4">
          <p>
            {t(
              'Thank you so much for your participation during PP Decides 26! People Powered staff are summarizing the results and, once the budget allocation is approved by the Board of Directors, we will announce the results!',
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
      title: match(currentPhaseId, {
        review: () => t('TIME TO VOTE.'),
        _: () => t('SHARE YOUR IDEAS.'),
      }),
      description: (
        <div className="flex flex-col gap-2">
          <p>
            The Horizon Fund Committee is deliberating based on their reviews
            and your votes. Results coming soon!
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
          {currentPhaseId === 'review' && maxVotesPerMember && (
            <p>
              Please select <strong>{maxVotesPerMember} proposals.</strong>
            </p>
          )}
        </div>
      ),
    }),
    _: () => ({
      title: t('SHARE YOUR IDEAS.'),
      description: (
        <p>{t('Help determine how we invest our community budget.')}</p>
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
