'use client';

import { trpc } from '@op/api/client';
import { ProposalReviewAssignmentStatus } from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCard } from './ProposalCard';
import {
  ReviewCardFooter,
  ReviewCardGrid,
  ReviewersTooltip,
  ReviewListHeader,
  ReviewProposalCardBody,
  ReviewProposalCardSkeleton,
  SortFilterSelect,
  useSortDir,
} from './Review';

export function AdminPhaseProposalsList({
  processInstanceId,
  phaseId,
  decisionSlug,
}: {
  processInstanceId: string;
  phaseId?: string;
  decisionSlug: string;
}) {
  const t = useTranslations();
  const [dir] = useSortDir();

  const { data: proposalsData, isLoading: proposalsLoading } =
    trpc.decision.listProposals.useQuery({
      processInstanceId,
      ...(phaseId && { phaseId }),
      dir,
      limit: 50,
    });

  const proposals = proposalsData?.proposals ?? [];
  const proposalIds = proposals.map((p) => p.id);

  const { data: aggregatesData, isLoading: aggregatesLoading } =
    trpc.decision.listWithReviewAggregates.useQuery(
      {
        processInstanceId,
        proposalIds,
      },
      {
        enabled: proposalIds.length > 0,
      },
    );

  const isLoading =
    proposalsLoading || (proposalIds.length > 0 && aggregatesLoading);

  return (
    <div className="flex flex-col gap-6">
      <ReviewListHeader
        title={t('Proposals in review')}
        count={proposals.length}
      >
        <SortFilterSelect />
      </ReviewListHeader>

      {isLoading ? (
        <ReviewCardGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <ReviewProposalCardSkeleton key={i} />
          ))}
        </ReviewCardGrid>
      ) : proposals.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {t('No proposals in this phase yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {t('Proposals will appear here once they are submitted.')}
          </p>
        </EmptyState>
      ) : (
        <ReviewCardGrid>
          {proposals.map((proposal) => {
            const reviewers = aggregatesData?.items.find(
              (i) => i.proposal.id === proposal.id,
            )?.aggregates.reviewers;
            const isRevised =
              reviewers?.some(
                (r) =>
                  r.status ===
                  ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
              ) ?? false;

            return (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                className="rounded-lg"
              >
                <ReviewProposalCardBody
                  proposal={proposal}
                  viewHref={`/decisions/${decisionSlug}/proposal/${proposal.profileId}`}
                  isRevised={isRevised}
                />
                {reviewers ? (
                  <ReviewCardFooter className="justify-end">
                    <ReviewersTooltip reviewers={reviewers} />
                  </ReviewCardFooter>
                ) : null}
              </ProposalCard>
            );
          })}
        </ReviewCardGrid>
      )}
    </div>
  );
}
