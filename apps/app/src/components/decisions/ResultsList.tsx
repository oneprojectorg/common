'use client';

import { formatAwardedAmount } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { StatusBadge } from '@op/sense/StatusBadge';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { getAllocatedAmount } from './BudgetDisplay';
import { ProposalCardView } from './ProposalCard';
import { ProposalListSection } from './ProposalListSection';
import { ProposalMasonry } from './ProposalMasonry';
import { resolveProposalSystemFields } from './proposalContentUtils';
import { proposalHref } from './proposalHrefs';
import { useOpenProposalInSheet } from './proposalSheetState';

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
  const openInSheet = useOpenProposalInSheet();

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
              ? formatAwardedAmount(
                  getAllocatedAmount({
                    allocated: proposal.allocated,
                    budget: resolveProposalSystemFields(proposal).budget,
                  }),
                )
              : undefined;

          return (
            <ProposalCardView
              key={proposal.id}
              proposal={proposal}
              href={viewHref}
              onTitleClick={openInSheet(proposal.profileId)}
              showMetrics
              totalVotes={showVotes ? (proposal.voteCount ?? 0) : undefined}
              awardedLabel={
                awardedText ? (
                  <StatusBadge variant="success" icon={false}>
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
