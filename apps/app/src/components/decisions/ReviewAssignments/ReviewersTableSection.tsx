'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { isPlainLeftClick } from '@/utils/isPlainLeftClick';
import { trpc } from '@op/api/client';
import {
  DEFAULT_REVIEWER_SORT,
  type PhaseReviewerSummary,
  ProposalReviewAssignmentStatus,
  type ReviewerSort,
  type ReviewerStatus,
  nextCursor,
  reviewerSortSchema,
  reviewerStatusSchema,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { Button } from '@op/sense/Button';
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
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  type MouseEvent,
  Suspense,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from 'react';
import { LuBell, LuUsers } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import {
  FilterBarActions,
  FilterBarEnd,
  FilterBarSearch,
  FilterBarSelect,
  FilterBarStart,
} from '../FilterBar';
import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { StickyFilterBar } from '../StickyFilterBar';
import { useSearchParam } from '../useSearchParam';
import { ReviewersTableSkeleton } from './ReviewAssignmentsSkeletons';
import { REVIEWER_PANEL_PARAM, ReviewerSheet } from './ReviewerSheet';
import {
  SendReminderDialog,
  type SendReminderTarget,
} from './SendReminderDialog';
import { accountContactText } from './accountContactText';

interface ReviewersTableSectionProps {
  decisionSlug: string;
  /** Owning profile slug, for the proposal route. */
  ownerSlug: string;
  processInstanceId: string;
  phaseId: string;
}

const reviewerStatusParser = parseAsStringLiteral(reviewerStatusSchema.options);
const reviewerSortParser = parseAsStringLiteral(
  reviewerSortSchema.options,
).withDefault(DEFAULT_REVIEWER_SORT);

export function ReviewersTableSection({
  ownerSlug,
  ...props
}: ReviewersTableSectionProps) {
  const t = useTranslations();
  const { decisionSlug, processInstanceId, phaseId } = props;
  const isMobile = useIsMobile();
  const [openReviewerId, setOpenReviewerId] = useQueryState(
    REVIEWER_PANEL_PARAM,
    parseAsString,
  );

  // Pushed, so Back closes the panel; a phone goes to the reviewer page instead.
  const openReviewer = useCallback(
    (reviewerProfileId: string) => {
      void setOpenReviewerId(reviewerProfileId, { history: 'push' });
    },
    [setOpenReviewerId],
  );
  const route = useMemo(
    () => ({ decisionSlug, slug: ownerSlug, instanceId: processInstanceId }),
    [decisionSlug, ownerSlug, processInstanceId],
  );

  return (
    <>
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
          <ReviewersTableContent
            {...props}
            onOpenReviewer={isMobile ? undefined : openReviewer}
          />
        </Suspense>
      </APIErrorBoundary>
      <ReviewerSheet
        processInstanceId={processInstanceId}
        phaseId={phaseId}
        route={route}
        reviewerProfileId={isMobile ? null : openReviewerId}
        pageHref={(reviewerProfileId) =>
          reviewerPageHref({ decisionSlug, reviewerProfileId })
        }
        onClose={() => void setOpenReviewerId(null)}
      />
    </>
  );
}

function ReviewersTableContent({
  decisionSlug,
  processInstanceId,
  phaseId,
  onOpenReviewer,
}: Omit<ReviewersTableSectionProps, 'ownerSlug'> & {
  /** Opens the reviewer panel. Omit to follow the link to the reviewer page. */
  onOpenReviewer?: (reviewerProfileId: string) => void;
}) {
  const t = useTranslations();

  const { search, setSearch, appliedSearch, isSearchPending } = useSearchParam({
    key: 'reviewerSearch',
  });
  const [status, setStatus] = useQueryState(
    'reviewerStatus',
    reviewerStatusParser,
  );
  const [sort, setSort] = useQueryState('reviewerSort', reviewerSortParser);

  const appliedStatus = useDeferredValue(status);
  const appliedSort = useDeferredValue(sort);

  const [data, query] =
    trpc.decision.listPhaseReviewerSummaries.useSuspenseInfiniteQuery(
      {
        processInstanceId,
        phaseId,
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(appliedStatus ? { status: appliedStatus } : {}),
        ...(appliedSort !== DEFAULT_REVIEWER_SORT ? { sort: appliedSort } : {}),
      },
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
  const total = data.pages[0]?.total ?? rows.length;
  const totalAssignments = data.pages[0]?.totalAssignments ?? 0;

  const [reminderTarget, setReminderTarget] =
    useState<SendReminderTarget | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const openReminder = (target: SendReminderTarget) => {
    setReminderTarget(target);
    setIsReminderOpen(true);
  };

  // A completed or idle reviewer has nothing open to be reminded of.
  const showSendReminder =
    totalAssignments > 0 &&
    appliedStatus !== ProposalReviewAssignmentStatus.COMPLETED &&
    appliedStatus !== 'none';

  const showToolbar = totalReviewers > 0 || Boolean(search || status);

  const statusItems: { id: 'all' | ReviewerStatus; label: string }[] = [
    { id: 'all', label: t('decisions.review.allStatusesOption') },
    { id: 'none', label: t('decisions.review.noAssignments') },
    {
      id: ProposalReviewAssignmentStatus.PENDING,
      label: t('decisions.review.statusNotStarted'),
    },
    {
      id: ProposalReviewAssignmentStatus.IN_PROGRESS,
      label: t('decisions.review.statusInProgress'),
    },
    {
      id: ProposalReviewAssignmentStatus.COMPLETED,
      label: t('decisions.review.statusCompleted'),
    },
  ];

  const sortItems: { id: ReviewerSort; label: string }[] = [
    {
      id: 'leastComplete',
      label: t('decisions.review.sortLeastComplete'),
    },
    { id: 'mostComplete', label: t('decisions.review.sortMostComplete') },
    {
      id: 'recentActivity',
      label: t('decisions.review.sortRecentActivity'),
    },
    { id: 'name', label: t('decisions.review.sortName') },
  ];

  const reviewerCount = (
    <ReviewerCount total={total} totalReviewers={totalReviewers} />
  );

  return (
    <div className="relative flex flex-col gap-6">
      {showToolbar ? (
        <StickyFilterBar>
          <FilterBarStart>
            {reviewerCount}
            <FilterBarSearch
              value={search}
              onChange={(next) => void setSearch(next === '' ? null : next)}
              isPending={isSearchPending}
              label={t('decisions.review.searchReviewersLabel')}
            />
          </FilterBarStart>
          <FilterBarEnd>
            <FilterBarSelect
              value={status ?? 'all'}
              onChange={(key) => void setStatus(key === 'all' ? null : key)}
              label={t('decisions.review.filterByStatusLabel')}
              items={statusItems}
            />
            <FilterBarSelect
              value={sort}
              onChange={(key) => void setSort(key)}
              label={t('decisions.review.sortReviewersLabel')}
              items={sortItems}
            />
            {showSendReminder ? (
              <FilterBarActions>
                <Button
                  variant="outline"
                  onClick={() =>
                    openReminder({
                      kind: 'batch',
                      ...(appliedSearch ? { search: appliedSearch } : {}),
                      ...(appliedStatus ? { status: appliedStatus } : {}),
                    })
                  }
                >
                  <LuBell data-icon="inline-start" />
                  {t('decisions.review.sendReminderAction')}
                </Button>
              </FilterBarActions>
            ) : null}
          </FilterBarEnd>
        </StickyFilterBar>
      ) : (
        reviewerCount
      )}

      {rows.length === 0 ? (
        <Empty className="rounded-md border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuUsers className="size-6" />
            </EmptyMedia>
            {totalReviewers === 0 ? (
              <>
                <EmptyTitle>{t('decisions.review.noReviewers')}</EmptyTitle>
                <EmptyDescription>
                  {t('decisions.review.noReviewersHint')}
                </EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>
                  {t('decisions.review.noReviewersMatchFilters')}
                </EmptyTitle>
                <EmptyDescription>
                  {t('decisions.proposals.adjustFiltersHint')}
                </EmptyDescription>
              </>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table
            aria-label={t('decisions.review.reviewersHeading')}
            className="w-full [&_tbody_th]:h-15 [&_td]:h-15 [&_thead_th]:font-normal [&_tr>*:first-child]:ps-0"
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
                <TableHead className="w-36">
                  <span className="sr-only">
                    {t('decisions.review.actionsColumn')}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <ReviewerRowCells
                  key={row.reviewer.id}
                  row={row}
                  href={reviewerPageHref({
                    decisionSlug,
                    reviewerProfileId: row.reviewer.id,
                  })}
                  onOpen={onOpenReviewer}
                  onRemind={openReminder}
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

      <SendReminderDialog
        processInstanceId={processInstanceId}
        phaseId={phaseId}
        target={reminderTarget}
        open={isReminderOpen}
        onOpenChange={setIsReminderOpen}
      />
    </div>
  );
}

function ReviewerCount({
  total,
  totalReviewers,
}: {
  total: number;
  totalReviewers: number;
}) {
  const t = useTranslations();

  return (
    <div role="status" aria-live="polite" className="flex items-baseline gap-1">
      {total < totalReviewers ? (
        t.rich('decisions.review.filteredReviewerCount', {
          count: total,
          total: totalReviewers,
          heading: (chunks) => <Header3>{chunks}</Header3>,
          muted: (chunks) => (
            <span className="text-base text-muted-foreground">{chunks}</span>
          ),
        })
      ) : (
        <Header3>
          {t('decisions.review.reviewerCount', { count: totalReviewers })}
        </Header3>
      )}
    </div>
  );
}

function ReviewerRowCells({
  row,
  href,
  onOpen,
  onRemind,
}: {
  row: PhaseReviewerSummary;
  href: string;
  onOpen?: (reviewerProfileId: string) => void;
  onRemind: (target: SendReminderTarget) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const name = row.reviewer.name ?? row.reviewer.slug ?? row.reviewer.id;
  const lastSubmittedAt = row.lastSubmittedAt
    ? new Date(row.lastSubmittedAt)
    : null;
  const percent =
    row.assignedCount > 0 ? (row.submittedCount / row.assignedCount) * 100 : 0;
  const isRemindable =
    row.remainingCount > 0 &&
    (row.status === ProposalReviewAssignmentStatus.PENDING ||
      row.status === ProposalReviewAssignmentStatus.IN_PROGRESS);
  const remind = () =>
    onRemind({
      kind: 'one',
      recipient: {
        id: row.reviewer.id,
        name,
        contact: row.reviewer.contact,
        remainingCount: row.remainingCount,
      },
    });
  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen || !isPlainLeftClick(event)) {
      return;
    }

    event.preventDefault();
    onOpen(row.reviewer.id);
  };

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
          onClick={handleLinkClick}
          className="static inline-flex after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
        >
          <ProfileItem
            avatar={<ProfileAvatar name={name} alt={name} />}
            title={name}
            titleClassName="font-normal"
            description={accountContactText(row.reviewer.contact) ?? undefined}
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
        {row.status === 'none' ? (
          <StatusBadge variant="inactive">
            {t('decisions.review.noAssignments')}
          </StatusBadge>
        ) : (
          <ReviewStatusBadge status={row.status} />
        )}
      </TableCell>
      <TableCell className="text-end">
        {isRemindable ? (
          // `z-10` lifts it above the name link's row-wide ::after.
          <Button
            variant="outline"
            className="z-10"
            aria-label={t('decisions.review.remindReviewerLabel', { name })}
            onClick={remind}
          >
            {t('decisions.review.remindAction')}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function reviewerPageHref({
  decisionSlug,
  reviewerProfileId,
}: {
  decisionSlug: string;
  reviewerProfileId: string;
}): string {
  return `/decisions/${decisionSlug}/assignments/${reviewerProfileId}`;
}
