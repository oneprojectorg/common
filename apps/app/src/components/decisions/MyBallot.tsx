'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Checkbox } from '@op/ui/Checkbox';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalCardContent,
  ProposalCardFooter,
  ProposalCardHeader,
  ProposalCardMeta,
  ProposalCardPreview,
} from './ProposalCard';
import { ProposalMasonry } from './ProposalMasonry';
import { VotingProposalCard } from './VotingProposalCard';

export const NoVoteFound = () => {
  const t = useTranslations();
  return (
    <EmptyState icon={<LuLeaf className="size-6" />}>
      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
        {t('You did not vote in this process.')}
      </Header3>
    </EmptyState>
  );
};

export const MyBallot = ({
  slug,
  instanceId,
  decisionSlug,
}: {
  slug: string;
  instanceId: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
}) => {
  const user = useUser();

  if (!user.user?.id) {
    return <NoVoteFound />;
  }

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });

  if (!voteStatus.hasVoted || !voteStatus.voteSubmission) {
    return <NoVoteFound />;
  }

  return (
    <MyBallotProposals
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
      votedByProfileId={voteStatus.voteSubmission.submittedByProfileId}
    />
  );
};

const MyBallotProposals = ({
  slug,
  instanceId,
  decisionSlug,
  votedByProfileId,
}: {
  slug: string;
  instanceId: string;
  decisionSlug?: string;
  votedByProfileId: string;
}) => {
  const t = useTranslations();

  const [proposalsData] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    votedByProfileId,
  });

  return (
    <div className="flex flex-col gap-4 pb-12">
      <Header3 className="font-serif !text-title-base">
        {t('My Ballot')}
      </Header3>

      <ProposalMasonry>
        {proposalsData.proposals.map((proposal) => {
          const viewHref = decisionSlug
            ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
            : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`;
          return (
            <VotingProposalCard
              isSelected={true}
              proposalId={proposal.id}
              key={proposal.id}
            >
              <ProposalCardContent>
                <ProposalCardHeader
                  proposal={proposal}
                  viewHref={viewHref}
                  menu={
                    <Checkbox
                      isSelected={true}
                      shape="circle"
                      borderColor="light"
                      aria-label={t('Selected proposal')}
                      isDisabled={true}
                    />
                  }
                />

                <ProposalCardMeta proposal={proposal} />

                <ProposalCardPreview proposal={proposal} />

                {/*
                  `voteCount` is null until results are published — showing a
                  bare "0 Total Votes" then would misreport the tally, so the
                  footer stays hidden (same rule as the funded-proposals tab).
                */}
                {proposal.voteCount != null ? (
                  <>
                    <div className="h-0 w-full border-b border-neutral-gray-2" />

                    <ProposalCardFooter>
                      <div className="flex items-start gap-1 text-base text-neutral-charcoal">
                        <span className="font-bold">{proposal.voteCount}</span>
                        <span>{t('Total Votes')}</span>
                      </div>
                    </ProposalCardFooter>
                  </>
                ) : null}
              </ProposalCardContent>
            </VotingProposalCard>
          );
        })}
      </ProposalMasonry>
    </div>
  );
};
