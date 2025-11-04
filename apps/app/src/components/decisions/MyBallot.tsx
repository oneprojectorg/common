'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Checkbox } from '@op/ui/Checkbox';
import { Header3 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

import { EmptyProposalsState } from './EmptyProposalsState';
import {
  ProposalCardContent,
  ProposalCardDescription,
  ProposalCardFooter,
  ProposalCardHeader,
  ProposalCardMeta,
} from './ProposalCard';
import { VotingProposalCard } from './VotingProposalCard';

export const NoVoteFound = () => {
  const t = useTranslations();
  return (
    <EmptyProposalsState>
      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
        {t('You did not vote in this process.')}
      </Header3>
    </EmptyProposalsState>
  );
};

export const MyBallot = ({
  slug,
  instanceId,
}: {
  slug: string;
  instanceId: string;
}) => {
  const t = useTranslations();
  const user = useUser();

  if (!user.user?.id) {
    return <NoVoteFound />;
  }

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });

  const [proposalsData] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    proposalIds: voteStatus.selectedProposals?.map((p) => p.id) || [],
  });

  if (!voteStatus.hasVoted || !voteStatus.selectedProposals) {
    return <NoVoteFound />;
  }

  const selectedProposalIds = new Set(
    voteStatus.selectedProposals.map((p) => p.id),
  );
  const proposals = proposalsData.proposals.filter((proposal) =>
    selectedProposalIds.has(proposal.id),
  );

  return (
    <div className="flex flex-col gap-4 pb-12">
      <Header3 className="font-serif !text-title-base">
        {t('My Ballot')}
      </Header3>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => (
          <VotingProposalCard
            isSelected={true}
            proposalId={proposal.id}
            key={proposal.id}
          >
            <ProposalCardContent>
              <ProposalCardHeader
                proposal={proposal}
                viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
                showMenu={true}
                menuComponent={
                  <Checkbox
                    isSelected={true}
                    shape="circle"
                    borderColor="light"
                    aria-label="Selected proposal"
                    isDisabled={true}
                  />
                }
              />

              <ProposalCardMeta proposal={proposal} />

              <ProposalCardDescription proposal={proposal} />

              <div className="border-neutral-silver h-0 w-full border-b" />

              <ProposalCardFooter>
                <div className="flex items-start gap-1 text-base text-neutral-charcoal">
                  <span className="font-bold">{proposal.voteCount ?? 0}</span>
                  <span>{t('Total Votes')}</span>
                </div>
              </ProposalCardFooter>
            </ProposalCardContent>
          </VotingProposalCard>
        ))}
      </div>
    </div>
  );
};
