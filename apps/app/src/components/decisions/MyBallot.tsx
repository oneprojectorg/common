'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Checkbox } from '@op/sense/Checkbox';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCardView } from './ProposalCard';
import { ProposalMasonry } from './ProposalMasonry';

export const NoVoteFound = () => {
  const t = useTranslations();
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('You did not vote in this process.')}</EmptyTitle>
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
            <ProposalCardView
              key={proposal.id}
              proposal={proposal}
              href={viewHref}
              selected
              showStatusBadge={false}
              totalVotes={proposal.voteCount ?? 0}
              aside={
                // TODO(sense-migration): sense Checkbox has no shape="circle"/
                // borderColor; approximated with rounded-full — revisit against
                // Figma vote design.
                <Checkbox
                  checked
                  disabled
                  aria-label={t('Selected proposal')}
                  className="rounded-full"
                />
              }
            />
          );
        })}
      </ProposalMasonry>
    </div>
  );
};
