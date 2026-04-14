'use client';

import { trpc } from '@op/api/client';
import { ProposalReviewAssignmentStatus } from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { ResponsiveSelect } from './ResponsiveSelect';
import { ReviewAssignmentCard } from './ReviewAssignmentCard';

const ASSIGNMENT_STATUSES = Object.values(ProposalReviewAssignmentStatus) as [
  string,
  ...string[],
];

const SORT_DIRS = ['asc', 'desc'] as const;

export function ReviewAssignmentsList({
  processInstanceId,
  decisionSlug,
}: {
  processInstanceId: string;
  decisionSlug: string;
}) {
  const t = useTranslations();

  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsStringLiteral(ASSIGNMENT_STATUSES),
  );
  const [dir, setDir] = useQueryState(
    'sort',
    parseAsStringLiteral(SORT_DIRS).withDefault('desc'),
  );

  const { data, isLoading } = trpc.decision.listReviewAssignments.useQuery({
    processInstanceId,
    ...(statusFilter && {
      status: statusFilter as ProposalReviewAssignmentStatus,
    }),
    dir,
  });

  const assignments = data?.assignments ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-serif text-title-base text-neutral-black">
            {t('Proposals to review')}
          </span>
          <Bullet />
          <span className="font-serif text-title-base text-neutral-black">
            {assignments.length}
          </span>
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:justify-end">
          <ResponsiveSelect
            selectedKey={statusFilter ?? 'all'}
            onSelectionChange={(key) =>
              setStatusFilter(key === 'all' ? null : key)
            }
            aria-label={t('Filter by status')}
            items={[
              { id: 'all', label: t('All statuses') },
              { id: 'pending', label: t('Not Started') },
              { id: 'in_progress', label: t('In Progress') },
              { id: 'completed', label: t('Completed') },
              {
                id: 'awaiting_author_revision',
                label: t('Revision Requested'),
              },
              { id: 'ready_for_re_review', label: t('Needs Review') },
            ]}
          />
          <ResponsiveSelect
            selectedKey={dir === 'asc' ? 'oldest' : 'newest'}
            onSelectionChange={(key) =>
              setDir(key === 'oldest' ? 'asc' : 'desc')
            }
            aria-label={t('Sort order')}
            items={[
              { id: 'newest', label: t('Newest First') },
              { id: 'oldest', label: t('Oldest First') },
            ]}
          />
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <ReviewAssignmentListSkeletonGrid />
      ) : assignments.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {statusFilter
              ? t('No reviews found matching the current filters.')
              : t('No reviews assigned yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {statusFilter
              ? t('Try adjusting your filter selection above.')
              : t('Review assignments will appear here once they are created.')}
          </p>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((item) => (
            <ReviewAssignmentCard
              key={item.assignment.id}
              assignment={item}
              viewHref={`/decisions/${decisionSlug}/reviews/${item.assignment.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ReviewAssignmentCardSkeleton = () => (
  <Surface className="relative w-full min-w-80 space-y-3 p-4 pb-4">
    {/* Title */}
    <Skeleton className="h-6 w-3/4" />

    {/* Author + category */}
    <div className="flex items-center gap-2">
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="size-1 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>

    {/* Description (2 lines) */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>

    {/* Status badge */}
    <Skeleton className="h-8 w-28 rounded-lg" />
  </Surface>
);

const ReviewAssignmentListSkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <ReviewAssignmentCardSkeleton key={index} />
    ))}
  </div>
);
