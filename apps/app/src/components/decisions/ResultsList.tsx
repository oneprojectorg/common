'use client';

import { trpc } from '@op/api/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { StatusBadge } from '@op/sense/StatusBadge';
import { LuBadgeCheck, LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { formatBudget } from './BudgetDisplay';
import { ProposalCardView } from './ProposalCard';
import { ProposalListSection } from './ProposalListSection';
import { ProposalMasonry } from './ProposalMasonry';
import { proposalHref } from './proposalHrefs';

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
    <ProposalListSection heading={t('decisions.selectedProposalsHeading')}>
      <ProposalMasonry>
        {proposals.map((proposal) => {
          const viewHref = proposalHref({
            profileId: proposal.profileId,
            decisionSlug,
            slug,
            instanceId,
          });

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
                    {t('decisions.amountAwarded', { amount: awardedText })}
                  </StatusBadge>
                ) : undefined
              }
            />
          );
        })}
      </ProposalMasonry>
    </ProposalListSection>
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
        <EmptyTitle render={<h3 />}>{t('decisions.noResultsYet')}</EmptyTitle>
        <EmptyDescription>
          {t('decisions.resultsInProgressNotice')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};
