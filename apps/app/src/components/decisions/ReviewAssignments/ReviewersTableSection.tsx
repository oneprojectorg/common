'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { PhaseReviewerSummary } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Progress } from '@op/sense/Progress';
import { Skeleton } from '@op/sense/Skeleton';
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
import { LuChevronRight, LuUsers } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

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
        getNextPageParam: (lastPage) => lastPage.next,
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

  const rows = data.pages.flatMap((page) => page.reviewers);
  const totalReviewers = data.pages[0]?.totalReviewers ?? rows.length;

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite">
        {t('{count, plural, one {# reviewer} other {# reviewers}}', {
          count: totalReviewers,
        })}
      </p>

      {rows.length === 0 ? (
        <Empty className="rounded-md border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuUsers className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{t('No reviewers yet')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'Give people the reviewer role and they will appear here, ready to take proposals.',
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table
            aria-label={t('Reviewers')}
            className="w-full [&_tbody_th]:px-5 [&_tbody_th]:py-3 [&_td]:px-5 [&_td]:py-3 [&_th]:px-5 [&_thead_th]:font-normal [&_tr>*:first-child]:ps-3 [&_tr>*:last-child]:pe-3"
          >
            <TableHeader>
              <TableRow>
                <TableHead>{t('Name')}</TableHead>
                <TableHead className="text-end">{t('Assigned')}</TableHead>
                <TableHead>{t('Progress')}</TableHead>
                <TableHead>{t('Last submission')}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t('Open')}</span>
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
                    {t('Loading more reviewers...')}
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
      <TableCell className="text-end">{row.assignedCount}</TableCell>
      <TableCell>
        {row.assignedCount === 0 ? (
          <span className="text-sm text-muted-foreground">
            {t('No assignments')}
          </span>
        ) : (
          <span className="flex items-center gap-2.5">
            <Progress
              value={percent}
              className="w-24"
              aria-label={t('Review progress')}
            />
            <span className="text-sm whitespace-nowrap text-muted-foreground">
              {t('{submitted} of {assigned} submitted', {
                submitted: row.submittedCount,
                assigned: row.assignedCount,
              })}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {lastSubmittedAt
          ? format.dateTime(lastSubmittedAt, { dateStyle: 'medium' })
          : '—'}
      </TableCell>
      <TableCell className="text-end">
        {/* z-10 keeps the chevron clickable above the stretched target. */}
        <ButtonLink
          href={href}
          variant="ghost"
          size="icon-sm"
          className="relative z-10"
          aria-label={t("Open {name}'s assignments", { name })}
        >
          <LuChevronRight className="rtl:-scale-x-100" />
        </ButtonLink>
      </TableCell>
    </TableRow>
  );
}
