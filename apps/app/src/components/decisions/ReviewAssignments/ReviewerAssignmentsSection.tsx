'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Suspense, useCallback, useId, useMemo } from 'react';
import { LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalSheetProvider } from '../ProposalSheet/ProposalSheetProvider';
import { ReviewProgressProposalSheet } from '../ProposalSheet/ReviewProgressProposalSheet';
import type { ProposalSheetRoute } from '../ProposalSheet/proposalSheetState';
import { proposalReviewsHref } from '../proposalHrefs';
import {
  ReviewerAssignmentsBodySkeleton,
  ReviewerHeaderSkeleton,
} from './ReviewAssignmentsSkeletons';
import {
  AssignmentsNextPage,
  ReviewerActions,
  ReviewerNoAssignments,
  ReviewerNotFound,
  ReviewerStats,
} from './ReviewerAssignmentsParts';
import { ReviewerAssignmentsTable } from './ReviewerAssignmentsTable';
import { ReviewerHeader } from './ReviewerHeader';
import {
  type ReviewerAssignmentsInput,
  getReviewerName,
  useReviewerAssignments,
} from './useReviewerAssignments';

interface ReviewerAssignmentsSectionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  decisionSlug: string;
  /** Owning profile slug, for the proposal route. */
  ownerSlug: string;
}

export function ReviewerAssignmentsSection({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  decisionSlug,
  ownerSlug,
}: ReviewerAssignmentsSectionProps) {
  const t = useTranslations();
  const route = useMemo<ProposalSheetRoute>(
    () => ({ decisionSlug, slug: ownerSlug, instanceId: processInstanceId }),
    [decisionSlug, ownerSlug, processInstanceId],
  );
  const expandHref = useCallback(
    (profileId: string) =>
      proposalReviewsHref({
        decisionSlug,
        slug: ownerSlug,
        instanceId: processInstanceId,
        profileId,
      }),
    [decisionSlug, ownerSlug, processInstanceId],
  );

  return (
    <ProposalSheetProvider {...route} expandHref={expandHref}>
      <APIErrorBoundary
        fallbacks={{
          default: () => (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LuUsers className="size-6" />
                </EmptyMedia>
                <EmptyTitle>
                  {t('decisions.review.loadAssignmentsError')}
                </EmptyTitle>
                <EmptyDescription>
                  {t('decisions.proposals.refreshPageHint')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ),
        }}
      >
        <Suspense
          fallback={
            <>
              <ReviewerHeaderSkeleton />
              <ReviewerAssignmentsBodySkeleton />
            </>
          }
        >
          <ReviewerAssignmentsContent
            input={{ processInstanceId, phaseId, reviewerProfileId }}
            route={route}
          />
        </Suspense>
      </APIErrorBoundary>
      <ReviewProgressProposalSheet phaseId={phaseId} />
    </ProposalSheetProvider>
  );
}

function ReviewerAssignmentsContent({
  input,
  route,
}: {
  input: ReviewerAssignmentsInput;
  route: ProposalSheetRoute;
}) {
  const t = useTranslations();
  const headingId = useId();
  const { summary, assignments, pagination } = useReviewerAssignments(input);

  if (!summary?.reviewer) {
    return <ReviewerNotFound />;
  }

  const { reviewer } = summary;
  const name = getReviewerName(reviewer);

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <ReviewerHeader name={name} contact={reviewer.contact} />
        <ReviewerActions
          input={input}
          summary={summary}
          reviewer={reviewer}
          name={name}
        />
      </div>

      {/* `total` drops merged-away proposals; the counts still hold their reviews. */}
      {summary.assignedCount > 0 ? (
        <ReviewerStats reviewer={summary} className="lg:grid-cols-4 lg:gap-6" />
      ) : null}

      {summary.total === 0 ? (
        <ReviewerNoAssignments input={input} name={name} />
      ) : (
        <div className="flex flex-col gap-4">
          <Header3 id={headingId} className="font-light">
            {t('decisions.review.assignedProposalsHeading', {
              count: summary.total,
            })}
          </Header3>
          <ReviewerAssignmentsTable
            assignments={assignments}
            route={route}
            labelledBy={headingId}
          />
          <AssignmentsNextPage pagination={pagination} />
        </div>
      )}
    </>
  );
}
