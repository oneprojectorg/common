'use client';

import { trpc } from '@op/api/client';
import { ProposalReviewAssignmentStatus } from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCard } from './ProposalCard';
import {
  ReviewCardGrid,
  ReviewersTooltip,
  ReviewListHeader,
  ReviewProposalCardBody,
  ReviewProposalCardSkeleton,
  ReviewStatusBadge,
  SortFilterSelect,
  StatusFilterSelect,
  useSortDir,
  useStatusFilter,
} from './Review';

export function ReviewAssignmentsList({
  processInstanceId,
  decisionSlug,
  canViewReviewers = false,
}: {
  processInstanceId: string;
  decisionSlug: string;
  canViewReviewers?: boolean;
}) {
  const t = useTranslations();

  const [statusFilter] = useStatusFilter();
  const [dir] = useSortDir();

  const { data, isLoading } = trpc.decision.listReviewAssignments.useQuery({
    processInstanceId,
    ...(statusFilter && {
      status: statusFilter as ProposalReviewAssignmentStatus,
    }),
    dir,
  });

  const assignments = data?.assignments ?? [];
  const proposalIds = assignments.map((a) => a.assignment.proposal.id);

  const { data: aggregatesData } =
    trpc.decision.listWithReviewAggregates.useQuery(
      {
        processInstanceId,
        proposalIds,
      },
      {
        enabled: canViewReviewers && proposalIds.length > 0,
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <ReviewListHeader
        title={t('Proposals to review')}
        count={assignments.length}
      >
        <StatusFilterSelect />
        <SortFilterSelect />
      </ReviewListHeader>

      {isLoading ? (
        <ReviewCardGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <ReviewProposalCardSkeleton key={i} />
          ))}
        </ReviewCardGrid>
      ) : assignments.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {statusFilter
              ? t('No reviews found matching the current filters.')
              : t('No reviews assigned yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {statusFilter
              ? t('Try adjusting your filter selection above.')
              : t('Review assignments will appear here once they are created.')}
          </p>
        </EmptyState>
      ) : (
        <ReviewCardGrid>
          {assignments.map((item) => {
            const { proposal, status } = item.assignment;
            const isRevised = status === 'ready_for_re_review';
            const reviewers = aggregatesData?.items.find(
              (i) => i.proposal.id === proposal.id,
            )?.aggregates.reviewers;

            return (
              <ProposalCard
                key={item.assignment.id}
                proposal={proposal}
                className="rounded-lg"
              >
                <ReviewProposalCardBody
                  proposal={proposal}
                  viewHref={`/decisions/${decisionSlug}/reviews/${item.assignment.id}`}
                  isRevised={isRevised}
                />
                <div className="flex items-center justify-between gap-2">
                  <ReviewStatusBadge status={status} />
                  {reviewers ? (
                    <ReviewersTooltip reviewers={reviewers} />
                  ) : null}
                </div>
              </ProposalCard>
            );
          })}
        </ReviewCardGrid>
      )}
    </div>
  );
}
