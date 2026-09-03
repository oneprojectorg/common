'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import type {
  ReviewAssignmentExtended,
  ReviewerAssignments,
} from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Item, ItemContent, ItemTitle } from '@op/sense/Item';
import { StatusDot } from '@op/sense/StatusDot';
import { useFormatter } from 'next-intl';
import { Suspense, useMemo } from 'react';
import { LuUserX, LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ReviewAssignmentCard } from '../ReviewAssignmentCard';
import { useReviewersByProposalId } from '../useReviewersByProposalId';
import {
  ReviewerAssignmentsBodySkeleton,
  ReviewerHeaderSkeleton,
} from './ReviewAssignmentsSkeletons';
import { ReviewerHeader } from './ReviewerHeader';
import {
  type AssignmentStatusValue,
  assignmentStatusRank,
  assignmentStatusSpecs,
} from './assignmentStatusSpecs';

interface ReviewerAssignmentsSectionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  /** Builds the per-proposal review-progress links on the cards. */
  decisionSlug: string;
  /** Decides whether the review count links to the progress screen. */
  access: DecisionAccess;
}

export function ReviewerAssignmentsSection(
  props: ReviewerAssignmentsSectionProps,
) {
  const t = useTranslations();

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuUsers className="size-6" />
              </EmptyMedia>
              <EmptyTitle>
                {t("We couldn't load review assignments")}
              </EmptyTitle>
              <EmptyDescription>
                {t('Please refresh the page to try again.')}
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
        <ReviewerAssignmentsContent {...props} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewerAssignmentsContent({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  decisionSlug,
  access,
}: ReviewerAssignmentsSectionProps) {
  const t = useTranslations();

  const [data] = trpc.decision.listReviewerAssignments.useSuspenseQuery(
    { processInstanceId, phaseId, reviewerProfileId },
    // An SSR-seeded entry never registers the realtime channel; refetch.
    { refetchOnMount: 'always' },
  );

  const reviewersByProposalId = useReviewersByProposalId({
    processInstanceId,
    phaseId,
    proposalIds: data.assignments.map((item) => item.assignment.proposal.id),
    enabled: access.admin,
  });

  // No identity means no tie to this process: a dead link, not an error.
  if (!data.reviewer) {
    return (
      <Empty className="rounded-md border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuUserX className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('Reviewer not found')}</EmptyTitle>
          <EmptyDescription>
            {t('This person does not review in this phase.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { reviewer } = data;
  const name = reviewer.name ?? reviewer.slug ?? reviewer.id;

  return (
    <>
      <ReviewerHeader name={name} email={reviewer.email} />

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Header3 className="font-light">
            {t('Assigned proposals ({count})', {
              count: data.assignments.length,
            })}
          </Header3>

          {data.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('Nothing assigned to this reviewer yet.')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.assignments.map((item) => {
                const href = `/decisions/${decisionSlug}/proposal/${item.assignment.proposal.profileId}/reviews`;

                return (
                  <li key={item.assignment.id}>
                    <ReviewAssignmentCard
                      assignment={item}
                      viewHref={href}
                      reviewsHref={href}
                      reviewers={reviewersByProposalId.get(
                        item.assignment.proposal.id,
                      )}
                      access={access}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ReviewProgressRail reviewer={data} />
      </div>
    </>
  );
}

function ReviewProgressRail({ reviewer }: { reviewer: ReviewerAssignments }) {
  const t = useTranslations();
  const format = useFormatter();

  const breakdown = useMemo(
    () => statusBreakdown(reviewer.assignments),
    [reviewer.assignments],
  );

  const lastSubmittedAt = reviewer.lastSubmittedAt
    ? new Date(reviewer.lastSubmittedAt)
    : null;

  return (
    <div className="flex w-full flex-col gap-3 lg:w-80 lg:shrink-0">
      <Header3 className="font-light">{t('Review progress')}</Header3>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t('{submitted} out of {assigned} assigned reviews are submitted', {
          submitted: reviewer.submittedCount,
          assigned: reviewer.assignedCount,
        })}
      </p>

      <StatCard
        label={t('Submitted')}
        value={t('{submitted}/{assigned} reviews', {
          submitted: reviewer.submittedCount,
          assigned: reviewer.assignedCount,
        })}
      />

      {breakdown.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {breakdown.map(({ status, count }) => (
            <li key={status} className="flex items-center gap-2 py-1.5 text-sm">
              <StatusDot intent={assignmentStatusSpecs[status].intent}>
                {t(assignmentStatusSpecs[status].label)}
              </StatusDot>
              <span className="ms-auto text-muted-foreground">{count}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <StatCard
        label={t('Last submission')}
        value={
          lastSubmittedAt
            ? format.dateTime(lastSubmittedAt, { dateStyle: 'medium' })
            : '—'
        }
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Item variant="muted" className="gap-3 border-border px-4 py-3 text-sm">
      <ItemContent>
        <ItemTitle className="text-sm font-normal">{label}</ItemTitle>
      </ItemContent>
      <span className="font-strong">{value}</span>
    </Item>
  );
}

function statusBreakdown(
  assignments: ReviewAssignmentExtended[],
): Array<{ status: AssignmentStatusValue; count: number }> {
  const counts = new Map<AssignmentStatusValue, number>();

  for (const item of assignments) {
    const status = item.review?.state ?? item.assignment.status;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort(
      (a, b) => assignmentStatusRank[a.status] - assignmentStatusRank[b.status],
    );
}
