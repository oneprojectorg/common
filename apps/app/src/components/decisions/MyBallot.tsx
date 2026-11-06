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
import { Suspense } from 'react';
import { LuLeaf, LuLock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCardView } from './ProposalCard';
import { ProposalListSection } from './ProposalListSection';
import { ProposalListSkeleton } from './ProposalListSkeleton';
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

  if (!user.user?.id) {
    return <NoVoteFound />;
  }

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });

  if (!voteStatus.hasVoted || !voteStatus.voteSubmission) {
    return <NoVoteFound />;
  }

  // A ballot cast before votes were unlinked comes with the status. One cast
  // since has no picks here: it opens with the receipt this browser holds.
  if (voteStatus.voteSubmission.selectedProposalIds.length > 0) {
    return (
      <MyBallotProposals
        slug={slug}
        instanceId={instanceId}
        decisionSlug={decisionSlug}
        votedByProfileId={voteStatus.voteSubmission.submittedByProfileId}
        rankedProposalIds={
          voteStatus.voteSubmission.ranked
            ? voteStatus.voteSubmission.selectedProposalIds
            : undefined
        }
      />
    );
  }

  return (
    <ReceiptBallot
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
      votedByProfileId={voteStatus.voteSubmission.submittedByProfileId}
    />
  );
};

/**
 * The receipt is read from this browser's storage, so it is unknown during
 * the server render and until hydration: the skeleton covers that gap
 * instead of a flash of "not on this device".
 */
const ReceiptBallot = ({
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
  const receiptState = useBallotReceipt(instanceId);

  switch (receiptState.status) {
    case 'pending':
      return <ProposalListSkeleton />;
    case 'none':
      return <BallotNotOnThisDevice />;
    case 'held':
      return (
        <Suspense fallback={<ProposalListSkeleton />}>
          <HeldBallot
            slug={slug}
            instanceId={instanceId}
            decisionSlug={decisionSlug}
            votedByProfileId={votedByProfileId}
            receipt={receiptState.receipt}
          />
        </Suspense>
      );
  }
};

const HeldBallot = ({
  slug,
  instanceId,
  decisionSlug,
  votedByProfileId,
  receipt,
}: {
  slug: string;
  instanceId: string;
  decisionSlug?: string;
  votedByProfileId: string;
  receipt: string;
}) => {
  const [ballot] = trpc.decision.getBallot.useSuspenseQuery({
    processInstanceId: instanceId,
    receipt,
  });

  // A receipt that opens nothing here was issued elsewhere, or its ballot is
  // gone.
  if (!ballot) {
    return <BallotNotOnThisDevice />;
  }

  return (
    <MyBallotProposals
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
      votedByProfileId={votedByProfileId}
      ballotReceipt={receipt}
      rankedProposalIds={ballot.ranked ? ballot.proposalIds : undefined}
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
