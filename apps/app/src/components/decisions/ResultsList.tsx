'use client';

import { trpc } from '@op/api/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { StatusBadge } from '@op/sense/StatusBadge';
import { LuBadgeCheck, LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { formatBudget } from './BudgetDisplay';
import { ProposalCardView } from './ProposalCard';
import { ProposalMasonry } from './ProposalMasonry';

export const ResultsList = ({
  slug,
  instanceId,
  decisionSlug,
}: {
  slug: string;
  instanceId: string;
  /** Decision profile slug for building proposal links in the new route structure */
  decisionSlug?: string;
}) => {
  const t = useTranslations();

  const [[instanceResults, resultStats]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstanceResults({
      instanceId,
    }),
    t.decision.getResultsStats({
      instanceId,
    }),
  ]);

  const { items: proposals } = instanceResults;

  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound />;
  }

  const showVotes = slug !== 'cowop' && Boolean(resultStats?.membersVoted);

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex items-center gap-4">
        <Header3>{t('Selected Proposals')}</Header3>
      </div>

      <ProposalMasonry>
        {proposals.map((proposal) => {
          const viewHref = decisionSlug
            ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
            : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`;

          const awardedText =
            proposal.allocated != null
              ? formatBudget(proposal.allocated)
              : undefined;

          return (
            <ProposalCardView
              key={proposal.id}
              proposal={proposal}
              href={viewHref}
              showMetrics
              totalVotes={showVotes ? (proposal.voteCount ?? 0) : undefined}
              awardedLabel={
                awardedText ? (
                  <StatusBadge variant="success" icon={LuBadgeCheck}>
                    {t('{amount} Awarded', { amount: awardedText })}
                  </StatusBadge>
                ) : undefined
              }
            />
          );
        })}
      </ProposalMasonry>
    </div>
  );
};

const NoProposalsFound = () => {
  const t = useTranslations();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('No results yet for this decision.')}</EmptyTitle>
        <EmptyDescription>
          {t('Results are still being worked on.')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};
