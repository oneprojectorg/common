'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
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
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { useFormatter } from 'next-intl';
import {
  type ReactNode,
  Suspense,
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react';
import { LuBell, LuListChecks, LuUserX, LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalSheetRoute } from '../ProposalSheet';
import { ProposalSheetProvider } from '../ProposalSheetProvider';
import { proposalReviewsHref } from '../proposalHrefs';
import { ManageAssignmentsAction } from './ManageAssignmentsAction';
import {
  ReviewerAssignmentsBodySkeleton,
  ReviewerHeaderSkeleton,
} from './ReviewAssignmentsSkeletons';
import { ReviewerAssignmentsTable } from './ReviewerAssignmentsTable';
import { ReviewerHeader } from './ReviewerHeader';
import {
  SendReminderDialog,
  type SendReminderTarget,
} from './SendReminderDialog';

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
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            reviewerProfileId={reviewerProfileId}
            route={route}
          />
        </Suspense>
      </APIErrorBoundary>
    </ProposalSheetProvider>
  );
}

function ReviewerAssignmentsContent({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  route,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  route: ProposalSheetRoute;
}) {
  const t = useTranslations();
  const headingId = useId();
  const [reminderTarget, setReminderTarget] =
    useState<SendReminderTarget | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  const [data, query] =
    trpc.decision.listReviewerAssignments.useSuspenseInfiniteQuery(
      { processInstanceId, phaseId, reviewerProfileId },
      {
        getNextPageParam: (lastPage) => lastPage.next,
        // An SSR-seeded entry never registers the realtime channel; refetch.
        refetchOnMount: 'always',
      },
    );

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref: scrollTriggerRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
    });

  const summary = data.pages[0];
  const assignments = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  // Reached only when the server prefetch failed, or the tie was removed since.
  if (!summary?.reviewer) {
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

  const { reviewer } = summary;
  const name = reviewer.name ?? reviewer.slug ?? reviewer.id;
  const actionProps = { processInstanceId, phaseId, reviewerProfileId };
  const openReminder = () => {
    setReminderTarget({
      kind: 'one',
      recipient: {
        id: reviewer.id,
        name,
        email: reviewer.email,
        remainingCount: summary.remainingCount,
      },
    });
    setIsReminderOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <ReviewerHeader name={name} email={reviewer.email} />
        {summary.remainingCount > 0 || summary.total > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden, not disabled: with nothing open there is nothing to remind. */}
            {summary.remainingCount > 0 ? (
              <Button onClick={openReminder}>
                <LuBell data-icon="inline-start" />
                {t('decisions.review.sendReminderAction')}
              </Button>
            ) : null}
            {summary.total > 0 ? (
              <ManageAssignmentsAction {...actionProps} />
            ) : null}
          </div>
        ) : null}
      </div>

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
            <ManageAssignmentsAction {...actionProps} intent="assign" />
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

      <SendReminderDialog
        processInstanceId={processInstanceId}
        phaseId={phaseId}
        target={reminderTarget}
        open={isReminderOpen}
        onOpenChange={setIsReminderOpen}
      />
    </>
  );
}

/** Four columns at `lg`, so later cards (started, reminders) slot in without a relayout. */
function ReviewerStats({ reviewer }: { reviewer: ReviewerAssignments }) {
  const t = useTranslations();
  const format = useFormatter();

  const lastSubmittedAt = reviewer.lastSubmittedAt
    ? new Date(reviewer.lastSubmittedAt)
    : null;

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
