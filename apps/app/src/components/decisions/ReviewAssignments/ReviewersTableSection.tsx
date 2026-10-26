'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type PhaseReviewerSummary,
  ProposalReviewAssignmentStatus,
  nextCursor,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Progress } from '@op/sense/Progress';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { Suspense, useCallback } from 'react';
import { LuUsers } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { ReviewersTableSkeleton } from './ReviewAssignmentsSkeletons';

interface ReviewersTableSectionProps {
  decisionSlug: string;
  processInstanceId: string;
  phaseId: string;
}

export function ReviewersTableSection(props: ReviewersTableSectionProps) {
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
      <Suspense fallback={<ReviewersTableSkeleton />}>
        <ReviewersTableContent {...props} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewersTableContent({
  decisionSlug,
  processInstanceId,
  phaseId,
}: ReviewersTableSectionProps) {
  const t = useTranslations();

  const [data, query] =
    trpc.decision.listPhaseReviewerSummaries.useSuspenseInfiniteQuery(
      { processInstanceId, phaseId },
      {
        getNextPageParam: nextCursor,
        // An SSR-seeded entry never registers the realtime channel; refetch.
        refetchOnMount: 'always',
      },
    );

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref: scrollTriggerRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(stableFetchNextPage, {
      hasNextPage,
      isFetchingNextPage,
    });

  const rows = data.pages.flatMap((page) => page.items);
  const totalReviewers = data.pages[0]?.totalReviewers ?? rows.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Same heading as the All proposals count, so the two tabs line up. */}
      <Header3 aria-live="polite">
        {t('decisions.review.reviewerCount', {
          count: totalReviewers,
        })}
      </Header3>

      {rows.length === 0 ? (
        <Empty className="rounded-md border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuUsers className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{t('decisions.review.noReviewers')}</EmptyTitle>
            <EmptyDescription>
              {t('decisions.review.noReviewersHint')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table
            aria-label={t('decisions.review.reviewersHeading')}
            className="w-full [&_tbody_th]:h-15 [&_td]:h-15 [&_thead_th]:font-normal [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
          >
            <TableHeader>
              <TableRow>
                <TableHead>{t('decisions.review.reviewerColumn')}</TableHead>
                <TableHead className="w-24">
                  {t('decisions.review.assignedLabel')}
                </TableHead>
                <TableHead className="w-56">
                  {t('decisions.review.submittedColumn')}
                </TableHead>
                <TableHead className="w-36">
                  {t('decisions.review.lastSubmissionLabel')}
                </TableHead>
                <TableHead className="w-44">
                  {t('decisions.review.statusColumn')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <ReviewerRowCells
                  key={row.reviewer.id}
                  row={row}
                  href={`/decisions/${decisionSlug}/assignments/${row.reviewer.id}`}
                />
              ))}
            </TableBody>
          </Table>

          {shouldShowTrigger ? (
            <div ref={scrollTriggerRef} className="flex flex-col gap-3 py-2">
              {isFetchingNextPage ? (
                <>
                  <span aria-live="polite" className="sr-only">
                    {t('decisions.review.loadingMoreReviewers')}
                  </span>
                  <Skeleton className="h-12 w-full" aria-hidden />
                  <Skeleton className="h-12 w-full" aria-hidden />
                </>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReviewerRowCells({
  row,
  href,
}: {
  row: PhaseReviewerSummary;
  href: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const name = row.reviewer.name ?? row.reviewer.slug ?? row.reviewer.id;
  const lastSubmittedAt = row.lastSubmittedAt
    ? new Date(row.lastSubmittedAt)
    : null;
  const percent =
    row.assignedCount > 0 ? (row.submittedCount / row.assignedCount) * 100 : 0;

  return (
    // `relative` anchors the name link's stretched ::after (row-wide click).
    // `transform-gpu` is load-bearing, not an optimization: WebKit ignores
    // `position: relative` on a <tr> as a containing block, so without it the
    // overlay escapes to the table container in Safari and one row swallows
    // every click in the table.
    <TableRow className="relative transform-gpu">
      <TableRowHeader>
        {/* `static` keeps the row the ::after's containing block — ANY
            transform or `relative` here collapses the row-wide target. */}
        <Link
          href={href}
          className="static inline-flex after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
        >
          <ProfileItem
            avatar={<ProfileAvatar name={name} alt={name} />}
            title={name}
            titleClassName="font-normal"
            description={row.reviewer.email ?? undefined}
          />
        </Link>
      </TableRowHeader>
      <TableCell className="tabular-nums">
        {row.assignedCount === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          row.assignedCount
        )}
      </TableCell>
      <TableCell>
        {row.assignedCount === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex items-center gap-2.5">
            <Progress
              value={percent}
              className="w-24"
              aria-label={t('decisions.review.reviewProgressLabel')}
            />
            <span className="text-sm whitespace-nowrap tabular-nums">
              {t('decisions.review.submittedOfAssignedShort', {
                submitted: row.submittedCount,
                assigned: row.assignedCount,
              })}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {lastSubmittedAt
          ? format.dateTime(lastSubmittedAt, { month: 'short', day: 'numeric' })
          : '—'}
      </TableCell>
      <TableCell>
        {row.assignedCount === 0 ? (
          <StatusBadge variant="inactive">
            {t('decisions.review.noAssignments')}
          </StatusBadge>
        ) : (
          <ReviewStatusBadge status={getReviewerStatus(row)} />
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * One reviewer's phase status, rolled up from the counts the summary already
 * carries. Only the three assignment statuses a rollup can land on.
 */
function getReviewerStatus({
  assignedCount,
  submittedCount,
  draftCount,
}: PhaseReviewerSummary): ProposalReviewAssignmentStatus {
  if (submittedCount === 0 && draftCount === 0) {
    return ProposalReviewAssignmentStatus.PENDING;
  }

  return submittedCount < assignedCount
    ? ProposalReviewAssignmentStatus.IN_PROGRESS
    : ProposalReviewAssignmentStatus.COMPLETED;
}
