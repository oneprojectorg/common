'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { AdminReviewAssignment } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Item, ItemContent, ItemTitle } from '@op/sense/Item';
import { ProposalCard } from '@op/sense/ProposalCard';
import { StatusDot } from '@op/sense/StatusDot';
import { useFormatter } from 'next-intl';
import { Suspense, useMemo } from 'react';
import { LuUserX, LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { formatBudget } from '../BudgetDisplay';
import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { ReviewerAssignmentsBodySkeleton } from './ReviewAssignmentsSkeletons';
import { ReviewerHeader } from './ReviewerHeader';
import {
  type AssignmentStatusValue,
  assignmentStatusRank,
  assignmentStatusSpecs,
} from './assignmentStatusSpecs';
import { type ReviewerRow, buildReviewerRows } from './buildReviewerRows';

interface ReviewerAssignmentsSectionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  /** False when the seeding fetch failed — then this section renders the header itself. */
  hasServerRenderedHeader: boolean;
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
      <Suspense fallback={<ReviewerAssignmentsBodySkeleton />}>
        <ReviewerAssignmentsContent {...props} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewerAssignmentsContent({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  hasServerRenderedHeader,
}: ReviewerAssignmentsSectionProps) {
  const t = useTranslations();

  const [data] = trpc.decision.listPhaseReviewAssignments.useSuspenseQuery(
    { processInstanceId, phaseId },
    // Refetch through the client link on mount — the SSR-seeded cache alone
    // never registers the `reviewAssignments` realtime channel.
    { refetchOnMount: 'always' },
  );

  const { rows, submittedCountByProposalId } = useMemo(
    () =>
      buildReviewerRows(data.reviewers, data.eligibleReviewers, data.proposals),
    [data.reviewers, data.eligibleReviewers, data.proposals],
  );

  const reviewer = rows.find((row) => row.profile.id === reviewerProfileId);

  // An id the list doesn't hold is a dead link, not a server error.
  if (!reviewer) {
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

  return (
    <>
      {hasServerRenderedHeader ? null : (
        <ReviewerHeader name={reviewer.label} email={reviewer.email} />
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Header3 className="font-light">
            {t('Assigned proposals ({count})', {
              count: reviewer.assignments.length,
            })}
          </Header3>

          {reviewer.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('Nothing assigned to this reviewer yet.')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {reviewer.assignments.map((assignment) => (
                <li key={assignment.id}>
                  <AssignmentCard
                    assignment={assignment}
                    reviewedCount={
                      submittedCountByProposalId.get(assignment.proposalId) ?? 0
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <ReviewProgressRail reviewer={reviewer} />
      </div>
    </>
  );
}

function AssignmentCard({
  assignment,
  reviewedCount,
}: {
  assignment: AdminReviewAssignment;
  reviewedCount: number;
}) {
  const t = useTranslations();

  const authorName = assignment.author
    ? (assignment.author.name ?? assignment.author.slug)
    : null;

  return (
    <ProposalCard
      title={assignment.proposalTitle ?? t('Untitled Proposal')}
      budget={formatBudget(assignment.budget) ?? undefined}
      tags={assignment.categories.map((category) => category.label)}
      authors={authorName ? [{ name: authorName }] : undefined}
      description={assignment.previewText ?? undefined}
      status={
        <ReviewStatusBadge
          status={assignment.reviewState ?? assignment.status}
        />
      }
      reviewedLabel={t('{count} Reviewed', { count: reviewedCount })}
    />
  );
}

function ReviewProgressRail({ reviewer }: { reviewer: ReviewerRow }) {
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
  assignments: AdminReviewAssignment[],
): Array<{ status: AssignmentStatusValue; count: number }> {
  const counts = new Map<AssignmentStatusValue, number>();

  for (const assignment of assignments) {
    const status = assignment.reviewState ?? assignment.status;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort(
      (a, b) => assignmentStatusRank[a.status] - assignmentStatusRank[b.status],
    );
}
