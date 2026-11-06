'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { LuLeaf, LuLock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCardView } from './ProposalCard';
import { ProposalListSection } from './ProposalListSection';
import { ProposalMasonry } from './ProposalMasonry';
import { VoteCheckbox } from './VoteCheckbox';
import { getBallotRank } from './ballot';
import { useBallotReceipt } from './ballotReceiptStore';
import { proposalHref } from './proposalHrefs';
import { useOpenProposalInSheet } from './proposalSheetState';

export const NoVoteFound = () => {
  const t = useTranslations();
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('decisions.review.noVoteCast')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
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
  const ballotReceipt = useBallotReceipt(instanceId);

  if (!user.user?.id) {
    return <NoVoteFound />;
  }

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
    receipt: ballotReceipt,
  });

  if (!voteStatus.hasVoted || !voteStatus.voteSubmission) {
    return <NoVoteFound />;
  }

  // A cast ballot always has a pick, so none means this browser holds no
  // receipt for it.
  if (voteStatus.voteSubmission.selectedProposalIds.length === 0) {
    return <BallotNotOnThisDevice />;
  }

  return (
    <MyBallotProposals
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
      votedByProfileId={voteStatus.voteSubmission.submittedByProfileId}
      ballotReceipt={ballotReceipt}
      rankedProposalIds={
        voteStatus.voteSubmission.ranked
          ? voteStatus.voteSubmission.selectedProposalIds
          : undefined
      }
    />
  );
};

const MyBallotProposals = ({
  slug,
  instanceId,
  decisionSlug,
  votedByProfileId,
  ballotReceipt,
  rankedProposalIds,
}: {
  slug: string;
  instanceId: string;
  decisionSlug?: string;
  votedByProfileId: string;
  ballotReceipt?: string;
  /** The ballot in rank order; undefined when the phase isn't ranked. */
  rankedProposalIds?: string[];
}) => {
  const t = useTranslations();
  const openInSheet = useOpenProposalInSheet();

  const [{ items: proposals }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    votedByProfileId,
    ballotReceipt,
  });

  return (
    <ProposalListSection heading={t('decisions.review.myBallotHeading')}>
      <ProposalMasonry>
        {proposals.map((proposal) => {
          const viewHref = proposalHref({
            profileId: proposal.profileId,
            decisionSlug,
            slug,
            instanceId,
          });
          const rank = rankedProposalIds
            ? getBallotRank({ ballotIds: rankedProposalIds, id: proposal.id })
            : undefined;

          return (
            <ProposalCardView
              key={proposal.id}
              proposal={proposal}
              href={viewHref}
              onTitleClick={openInSheet(proposal.profileId)}
              selected
              headerBadge={null}
              // `voteCount` is null until results are published — a bare
              // "0 Total Votes" then would misreport the tally, so the votes
              // row stays hidden (same rule as the funded-proposals tab).
              totalVotes={proposal.voteCount ?? undefined}
              aside={
                <VoteCheckbox
                  ranked={!!rankedProposalIds}
                  rank={rank}
                  checked
                  disabled
                  aria-label={
                    rank === undefined
                      ? t('decisions.proposals.selectedProposalLabel')
                      : t('decisions.proposals.votedRankedProposalLabel', {
                          rank,
                        })
                  }
                />
              }
            />
          );
        })}
      </ProposalMasonry>
    </ProposalListSection>
  );
};

const BallotNotOnThisDevice = () => {
  const t = useTranslations();
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLock className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('decisions.review.ballotNotOnDeviceTitle')}</EmptyTitle>
        <EmptyDescription>
          {t('decisions.review.ballotNotOnDeviceDescription')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};
