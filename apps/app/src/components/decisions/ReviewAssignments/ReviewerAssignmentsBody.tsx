'use client';

import type {
  ReviewAssignmentExtended,
  ReviewerAssignments,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Card } from '@op/sense/Card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { useFormatter } from 'next-intl';
import { type ReactNode, useCallback, useId, useState } from 'react';
import { LuBell, LuListChecks, LuUserX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalSheetRoute } from '../ProposalSheet/proposalSheetState';
import { ManageAssignmentsAction } from './ManageAssignmentsAction';
import { ReviewerAssignmentsTable } from './ReviewerAssignmentsTable';
import {
  SendReminderDialog,
  type SendReminderTarget,
} from './SendReminderDialog';
import type {
  ReviewerAssignmentsInput,
  ReviewerAssignmentsPagination,
} from './useReviewerAssignments';

interface ReviewerAssignmentsBodyProps {
  input: ReviewerAssignmentsInput;
  summary: ReviewerAssignments;
  name: string;
  assignments: ReviewAssignmentExtended[];
  pagination: ReviewerAssignmentsPagination;
  route: ProposalSheetRoute;
}

/** The stat cards and the assigned proposals, below a header the caller owns. */
export function ReviewerAssignmentsBody({
  input,
  summary,
  name,
  assignments,
  pagination: { fetchNextPage, hasNextPage, isFetchingNextPage },
  route,
}: ReviewerAssignmentsBodyProps) {
  const t = useTranslations();
  const headingId = useId();

  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref: scrollTriggerRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
    });

  return (
    <>
      {/* `total` drops merged-away proposals; the counts still hold their reviews. */}
      {summary.assignedCount > 0 ? <ReviewerStats reviewer={summary} /> : null}

      {summary.total === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuListChecks className="size-6" />
            </EmptyMedia>
            <EmptyTitle className="text-headline font-light">
              {t('decisions.review.noProposalsAssignedTitle')}
            </EmptyTitle>
            <EmptyDescription>
              {t.rich('decisions.review.reviewerNothingToReview', {
                name: getFirstName(name),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ManageAssignmentsAction {...input} intent="assign" />
          </EmptyContent>
        </Empty>
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

          {/* Hidden from the a11y tree; the `aria-live` line below announces loading. */}
          {shouldShowTrigger ? (
            <div ref={scrollTriggerRef} aria-hidden>
              {isFetchingNextPage ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-15 w-full" />
                  <Skeleton className="h-15 w-full" />
                </div>
              ) : null}
            </div>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {isFetchingNextPage
              ? t('decisions.review.loadingMoreProposals')
              : ''}
          </p>
        </div>
      )}
    </>
  );
}

/** Send reminder while proposals remain, and Edit assignments once any are assigned. */
export function ReviewerActions({
  input,
  summary,
  reviewer,
  name,
}: {
  input: ReviewerAssignmentsInput;
  summary: ReviewerAssignments;
  reviewer: NonNullable<ReviewerAssignments['reviewer']>;
  name: string;
}) {
  const t = useTranslations();
  const [reminderTarget, setReminderTarget] =
    useState<SendReminderTarget | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  if (summary.remainingCount === 0 && summary.total === 0) {
    return null;
  }

  const openReminder = () => {
    setReminderTarget({
      kind: 'one',
      recipient: {
        id: reviewer.id,
        name,
        contact: reviewer.contact,
        remainingCount: summary.remainingCount,
      },
    });
    setIsReminderOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {summary.remainingCount > 0 ? (
        <Button onClick={openReminder}>
          <LuBell data-icon="inline-start" />
          {t('decisions.review.sendReminderAction')}
        </Button>
      ) : null}
      {summary.total > 0 ? <ManageAssignmentsAction {...input} /> : null}
      <SendReminderDialog
        processInstanceId={input.processInstanceId}
        phaseId={input.phaseId}
        target={reminderTarget}
        open={isReminderOpen}
        onOpenChange={setIsReminderOpen}
      />
    </div>
  );
}

/** Reached only when the server prefetch failed, or the tie was removed since. */
export function ReviewerNotFound() {
  const t = useTranslations();

  return (
    <Empty className="rounded-md border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuUserX className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('decisions.review.reviewerNotFound')}</EmptyTitle>
        <EmptyDescription>
          {t('decisions.review.reviewerNotInPhase')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Four columns at `lg`, so later cards (started, reminders) slot in without a relayout. */
function ReviewerStats({ reviewer }: { reviewer: ReviewerAssignments }) {
  const t = useTranslations();
  const format = useFormatter();

  const lastSubmittedAt = reviewer.lastSubmittedAt
    ? new Date(reviewer.lastSubmittedAt)
    : null;
  const startedAt = reviewer.startedAt ? new Date(reviewer.startedAt) : null;

  return (
    <div
      aria-live="polite"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6"
    >
      <StatCard label={t('decisions.review.reviewsSubmittedLabel')}>
        {t.rich('decisions.review.reviewsSubmittedFigure', {
          submitted: reviewer.submittedCount,
          assigned: reviewer.assignedCount,
          total: (chunks) => (
            <span className="text-muted-foreground">{chunks}</span>
          ),
        })}
      </StatCard>
      <StatCard
        label={
          startedAt
            ? t('decisions.review.startedLabel')
            : t('decisions.review.notStartedLabel')
        }
      >
        {startedAt ? format.dateTime(startedAt, { dateStyle: 'medium' }) : '—'}
      </StatCard>
      <StatCard label={t('decisions.review.lastSubmissionLabel')}>
        {lastSubmittedAt
          ? format.dateTime(lastSubmittedAt, { dateStyle: 'medium' })
          : '—'}
      </StatCard>
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="gap-2 p-4">
      <span className="text-base text-muted-foreground">{label}</span>
      <span className="font-serif text-headline font-light tabular-nums">
        {children}
      </span>
    </Card>
  );
}

/** The design's empty state greets the reviewer by first name. */
function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
