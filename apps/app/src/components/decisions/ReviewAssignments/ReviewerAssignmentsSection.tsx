'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Suspense, useCallback, useMemo } from 'react';
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
  ReviewerActions,
  ReviewerAssignmentsBody,
  ReviewerNotFound,
} from './ReviewerAssignmentsBody';
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

      <ReviewerAssignmentsBody
        input={input}
        summary={summary}
        name={name}
        assignments={assignments}
        pagination={pagination}
        route={route}
      />
    </>
  );
}
