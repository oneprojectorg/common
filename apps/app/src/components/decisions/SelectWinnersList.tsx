'use client';

import { trpc } from '@op/api/client';
import type {
  ProposalCategoryItem,
  RubricTemplateSchema,
} from '@op/common/client';
import { getRubricScoringInfo } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';

import { ResponsiveSelect } from './ResponsiveSelect';
import {
  SelectWinnersTable,
  SelectWinnersTableSkeleton,
} from './SelectWinnersTable';

type SortKey = 'newest' | 'oldest' | 'highestScore' | 'lowestScore';

const SORT_TO_QUERY: Record<
  SortKey,
  { sortBy: 'createdAt' | 'totalScore'; dir: 'asc' | 'desc' }
> = {
  newest: { sortBy: 'createdAt', dir: 'desc' },
  oldest: { sortBy: 'createdAt', dir: 'asc' },
  highestScore: { sortBy: 'totalScore', dir: 'desc' },
  lowestScore: { sortBy: 'totalScore', dir: 'asc' },
};

export function SelectWinnersList({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations();

  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Selected proposals — kept client-side until "Confirm decisions" lands in
  // a follow-up PR. Stored as a Set so toggling is O(1) regardless of list size.
  const [advancing, setAdvancing] = useState<Set<string>>(() => new Set());

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: processInstanceId,
  });

  const { sortBy, dir } = SORT_TO_QUERY[sortKey];

  const [data] = trpc.decision.listWithReviewAggregates.useSuspenseQuery({
    processInstanceId,
    sortBy,
    dir,
    limit: 100,
    ...(categoryId ? { categoryId } : {}),
  });

  const items = data.items;
  const total = data.total;

  const rubricTemplate = (instance.instanceData?.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const totalPoints = useMemo(
    () =>
      rubricTemplate ? getRubricScoringInfo(rubricTemplate).totalPoints : 0,
    [rubricTemplate],
  );

  const categoryOptions = useMemo(
    () => buildCategoryOptions(items.flatMap((i) => i.categories)),
    [items],
  );

  const handleAdvanceToggle = (proposalId: string) => {
    setAdvancing((prev) => {
      const next = new Set(prev);
      if (next.has(proposalId)) {
        next.delete(proposalId);
      } else {
        next.add(proposalId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-serif text-title-base text-neutral-black">
            {t('All proposals')}
          </span>
          <Bullet />
          <span className="font-serif text-title-base text-neutral-black">
            {total}
          </span>
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:justify-end">
          {/* Status filter is shown for design parity but is a placeholder
              until proposal status filtering lands on the aggregates API. */}
          <ResponsiveSelect
            selectedKey="all"
            onSelectionChange={() => {}}
            aria-label={t('Filter by status')}
            items={[{ id: 'all', label: t('All statuses') }]}
          />
          <ResponsiveSelect
            selectedKey={categoryId ?? 'all'}
            onSelectionChange={(key) =>
              setCategoryId(key === 'all' ? null : key)
            }
            aria-label={t('Filter by category')}
            items={[
              { id: 'all', label: t('All categories') },
              ...categoryOptions,
            ]}
          />
          <ResponsiveSelect
            selectedKey={sortKey}
            onSelectionChange={(key) => setSortKey(key)}
            aria-label={t('Sort order')}
            items={[
              { id: 'newest', label: t('Newest First') },
              { id: 'oldest', label: t('Oldest First') },
              { id: 'highestScore', label: t('Highest Score') },
              { id: 'lowestScore', label: t('Lowest Score') },
            ]}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {categoryId
              ? t('No proposals found matching the current filters.')
              : t('No proposals to review yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {categoryId
              ? t('Try adjusting your filter selection above.')
              : t('Proposals will appear here once they are submitted.')}
          </p>
        </EmptyState>
      ) : (
        <SelectWinnersTable
          items={items}
          totalPoints={totalPoints}
          sortBy={sortBy}
          dir={dir}
          onSortChange={(nextSortBy, nextDir) => {
            if (nextSortBy === 'createdAt') {
              setSortKey(nextDir === 'asc' ? 'oldest' : 'newest');
            } else {
              setSortKey(nextDir === 'asc' ? 'lowestScore' : 'highestScore');
            }
          }}
          onAdvance={handleAdvanceToggle}
          advancingIds={advancing}
        />
      )}

      <ConfirmFooter advancingCount={advancing.size} />
    </div>
  );
}

export function SelectWinnersListSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="h-8 w-32 animate-pulse rounded bg-neutral-gray1" />
      <SelectWinnersTableSkeleton />
    </div>
  );
}

function ConfirmFooter({ advancingCount }: { advancingCount: number }) {
  const t = useTranslations();

  return (
    <div className="fixed right-0 bottom-0 left-0 z-10 flex w-full items-center justify-between border-t border-neutral-gray1 bg-neutral-offWhite/95 px-4 py-2 backdrop-blur sm:px-44">
      <span className="text-sm text-neutral-black">
        {t('{count} proposals advancing', { count: advancingCount })}
      </span>
      <Button
        size="medium"
        color="primary"
        isDisabled={advancingCount === 0}
        onPress={() => {
          // Mutation lands in a follow-up PR — confirm-decisions API.
        }}
      >
        {t('Confirm decisions')}
      </Button>
    </div>
  );
}

function buildCategoryOptions(
  categories: ProposalCategoryItem[],
): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const c of categories) {
    if (!seen.has(c.id)) {
      seen.set(c.id, c.label);
    }
  }
  return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
}
