'use client';

import type { ReviewerAssignments } from '@op/common/client';
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
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { useFormatter } from 'next-intl';
import { type ReactNode, useCallback, useState } from 'react';
import { LuBell, LuListChecks, LuUserX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ManageAssignmentsAction } from './ManageAssignmentsAction';
import {
  SendReminderDialog,
  type SendReminderTarget,
} from './SendReminderDialog';
import type {
  ReviewerAssignmentsInput,
  ReviewerAssignmentsPagination,
} from './useReviewerAssignments';

export function ReviewerNoAssignments({
  input,
  name,
}: {
  input: ReviewerAssignmentsInput;
  name: string;
}) {
  const t = useTranslations();

  return (
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
  );
}

/** Loads the next page when it scrolls into view, and announces the load. */
export function AssignmentsNextPage({
  pagination: { fetchNextPage, hasNextPage, isFetchingNextPage },
  scrollRoot = null,
}: {
  pagination: ReviewerAssignmentsPagination;
  /** Scrolling ancestor of the list. Omit when the page scrolls. */
  scrollRoot?: Element | null;
}) {
  const t = useTranslations();
  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref: scrollTriggerRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
      root: scrollRoot,
    });

  return (
    <>
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
        {isFetchingNextPage ? t('decisions.review.loadingMoreProposals') : ''}
      </p>
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

/** Two columns; the caller widens the grid where it has the room. */
export function ReviewerStats({
  reviewer,
  className,
}: {
  reviewer: ReviewerAssignments;
  className?: string;
}) {
  const t = useTranslations();
  const format = useFormatter();

  const lastSubmittedAt = reviewer.lastSubmittedAt
    ? new Date(reviewer.lastSubmittedAt)
    : null;
  const startedAt = reviewer.startedAt ? new Date(reviewer.startedAt) : null;

  return (
    <div aria-live="polite" className={cn('grid grid-cols-2 gap-4', className)}>
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
