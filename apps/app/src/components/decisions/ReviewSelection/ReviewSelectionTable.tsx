'use client';

import { formatCurrency } from '@/utils/formatting';
import {
  type ProposalWithAggregates,
  RECOMMENDATION_OPTION,
  type RecommendationValue,
} from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { type ColumnDef, DataTable } from '@op/ui-next/DataTable';
import { Link } from '@op/ui-next/Link';
import { Skeleton } from '@op/ui-next/Skeleton';
import { StatusDot, type StatusDotIntent } from '@op/ui-next/StatusDot';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { AdvanceToggleButton } from '../selection/AdvanceToggleButton';
import { SelectionCard } from '../selection/SelectionCard';
import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';

const RECOMMENDATION_INTENT: Record<RecommendationValue, StatusDotIntent> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
};

export function ReviewSelectionTable({
  items,
  totalPoints,
  onAdvance,
  advancingIds,
  decisionSlug,
}: {
  items: ProposalWithAggregates[];
  /** Maximum possible score from the rubric, e.g. 50 → header reads "Score (50pts)". */
  totalPoints: number;
  onAdvance: (proposalId: string) => void;
  advancingIds: ReadonlySet<string>;
  /** Decision profile slug used to build per-proposal review summary links. */
  decisionSlug: string;
}) {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);

  const columns = useMemo<ColumnDef<ProposalWithAggregates, unknown>[]>(
    () => [
      {
        id: 'proposal',
        header: t('Proposal'),
        cell: ({ row }) => {
          const item = row.original;
          const title = item.proposal.profile.name;
          const submitterName = item.proposal.submittedBy?.name ?? null;
          return (
            <div className="flex flex-col">
              <Link
                href={`/decisions/${decisionSlug}/proposal/${item.proposal.profileId}/reviews`}
                variant="neutral"
                className="line-clamp-1 text-base text-neutral-black hover:underline"
              >
                {title}
              </Link>
              {submitterName && (
                <span className="line-clamp-1 text-sm text-neutral-gray4">
                  {submitterName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'budget',
        header: t('Budget'),
        cell: ({ row }) => {
          const budget = row.original.proposal.proposalData.budget;
          return (
            <span className="text-base text-neutral-black">
              {budget
                ? formatCurrency(budget.amount, undefined, budget.currency)
                : '—'}
            </span>
          );
        },
      },
      {
        id: 'category',
        header: t('Category'),
        cell: ({ row }) => (
          <SelectionCategoryChips
            labels={row.original.categories.map((c) => c.label)}
          />
        ),
      },
      {
        id: 'recommendation',
        header: t('Overall recommendation'),
        cell: ({ row }) => (
          <RecommendationCounts
            counts={row.original.aggregates.overallRecommendationCount}
          />
        ),
      },
      {
        id: 'score',
        header: () => (
          <span className="underline decoration-dotted">
            {t('Score ({pts}pts)', { pts: totalPoints })}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-base text-neutral-black">
            <ScoreText value={row.original.aggregates.averageScore} />
          </span>
        ),
      },
      {
        id: 'action',
        header: () => <span className="sr-only">{t('Advance')}</span>,
        cell: ({ row }) => {
          const advancing = advancingIds.has(row.original.proposal.id);
          const title = row.original.proposal.profile.name;
          return (
            <AdvanceToggleButton
              isSelected={advancing}
              onPress={() => onAdvance(row.original.proposal.id)}
              title={title}
              className="w-28 justify-center"
            />
          );
        },
      },
    ],
    [t, decisionSlug, totalPoints, onAdvance, advancingIds],
  );

  if (isMobile) {
    return (
      <ul className="flex flex-col gap-3" aria-label={t('All proposals')}>
        {items.map((item) => {
          const advancing = advancingIds.has(item.proposal.id);
          return (
            <li key={item.proposal.id}>
              <ProposalCard
                item={item}
                advancing={advancing}
                onAdvance={() => onAdvance(item.proposal.id)}
                decisionSlug={decisionSlug}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <DataTable
      aria-label={t('All proposals')}
      columns={columns}
      data={items}
      getRowId={(item) => item.proposal.id}
    />
  );
}

export function ReviewSelectionTableSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full items-center justify-between border-b border-neutral-gray1 py-2">
        <Skeleton className="h-4 w-20" />
        <div className="hidden gap-8 md:flex">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex w-full items-center justify-between gap-4 border-b border-neutral-gray1 py-2"
        >
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-4 w-12 md:block" />
          <Skeleton className="hidden h-5 w-32 md:block" />
          <Skeleton className="hidden h-4 w-32 md:block" />
          <Skeleton className="hidden h-4 w-12 md:block" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

function ProposalCard({
  item,
  advancing,
  onAdvance,
  decisionSlug,
}: {
  item: ProposalWithAggregates;
  advancing: boolean;
  onAdvance: () => void;
  decisionSlug: string;
}) {
  const t = useTranslations();
  const title = item.proposal.profile.name || t('Untitled Proposal');
  const submitterName = item.proposal.submittedBy?.name ?? null;
  const budget = item.proposal.proposalData.budget;

  return (
    <SelectionCard isSelected={advancing}>
      <div className="flex flex-col gap-1">
        <Link
          href={`/decisions/${decisionSlug}/proposal/${item.proposal.profileId}/reviews`}
          variant="neutral"
          className="text-base text-neutral-black hover:underline"
        >
          {title}
        </Link>
        {submitterName && (
          <span className="text-sm text-neutral-gray4">{submitterName}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {budget && (
          <span className="text-base text-neutral-black">
            {formatCurrency(budget.amount, undefined, budget.currency)}
          </span>
        )}
        <SelectionCategoryChips labels={item.categories.map((c) => c.label)} />
      </div>

      <RecommendationCounts
        counts={item.aggregates.overallRecommendationCount}
      />

      <div className="flex items-center justify-between">
        <span className="text-base text-neutral-black">
          <ScoreText value={item.aggregates.averageScore} />
        </span>
        <AdvanceToggleButton
          isSelected={advancing}
          onPress={onAdvance}
          title={title}
        />
      </div>
    </SelectionCard>
  );
}

function RecommendationCounts({
  counts,
}: {
  counts: ProposalWithAggregates['aggregates']['overallRecommendationCount'];
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-4 text-base text-neutral-black">
      {Object.values(RECOMMENDATION_OPTION).map((opt) => (
        <CountLabel
          key={opt.value}
          value={counts[opt.value] ?? 0}
          label={t(opt.label)}
          intent={RECOMMENDATION_INTENT[opt.value]}
        />
      ))}
    </div>
  );
}

function CountLabel({
  value,
  label,
  intent,
}: {
  value: number;
  label: string;
  intent: StatusDotIntent;
}) {
  return (
    <StatusDot intent={intent} className="text-base text-neutral-black">
      {value} {label}
    </StatusDot>
  );
}

function ScoreText({ value }: { value: number }) {
  const t = useTranslations();
  const display = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return <>{t('{pts} pts', { pts: display })}</>;
}
