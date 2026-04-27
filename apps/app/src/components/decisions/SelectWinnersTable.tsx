'use client';

import { formatCurrency } from '@/utils/formatting';
import type { ProposalWithAggregates } from '@op/common/client';
import { OVERALL_RECOMMENDATION_KEY } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import { Skeleton } from '@op/ui/Skeleton';
import type { ReactNode } from 'react';
import { LuArrowDown, LuArrowUp } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

type SortColumn = 'createdAt' | 'totalScore';
type SortDir = 'asc' | 'desc';

type Item = ProposalWithAggregates;

export function SelectWinnersTable({
  items,
  totalPoints,
  sortBy,
  dir,
  onSortChange,
  onAdvance,
  advancingIds,
}: {
  items: Item[];
  /** Maximum possible score from the rubric, e.g. 50 → header reads "Score (50pts)". */
  totalPoints: number;
  sortBy: SortColumn;
  dir: SortDir;
  onSortChange: (sortBy: SortColumn, dir: SortDir) => void;
  onAdvance: (proposalId: string) => void;
  advancingIds: ReadonlySet<string>;
}) {
  const t = useTranslations();

  return (
    <div className="flex w-full flex-col">
      <HeaderRow
        totalPoints={totalPoints}
        sortBy={sortBy}
        dir={dir}
        onSortChange={onSortChange}
      />
      {items.map((item) => (
        <BodyRow
          key={item.id}
          item={item}
          advancing={advancingIds.has(item.id)}
          onAdvance={() => onAdvance(item.id)}
          advanceLabel={
            advancingIds.has(item.id) ? t("Don't advance") : t('Advance')
          }
        />
      ))}
    </div>
  );
}

export function SelectWinnersTableSkeleton() {
  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full items-start justify-between border-b border-neutral-gray1 py-2">
        <Skeleton className="h-4 w-16" />
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
          <div className="flex w-[220px] flex-col gap-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-4 w-12 md:block" />
          <Skeleton className="hidden h-5 w-32 md:block" />
          <Skeleton className="hidden h-4 w-32 md:block" />
          <Skeleton className="hidden h-4 w-12 md:block" />
          <Skeleton className="h-8 w-[110px]" />
        </div>
      ))}
    </div>
  );
}

function HeaderRow({
  totalPoints,
  sortBy,
  dir,
  onSortChange,
}: {
  totalPoints: number;
  sortBy: SortColumn;
  dir: SortDir;
  onSortChange: (sortBy: SortColumn, dir: SortDir) => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex w-full items-start justify-between gap-4 border-b border-neutral-gray1 py-2 text-xs text-neutral-gray4">
      <SortableHeader
        label={t('Proposal')}
        column="createdAt"
        active={sortBy === 'createdAt'}
        dir={dir}
        onSortChange={onSortChange}
        className="w-[220px]"
      />
      <div className="hidden w-[60px] shrink-0 md:block">{t('Budget')}</div>
      <div className="hidden w-[220px] shrink-0 md:block">{t('Category')}</div>
      <div className="hidden w-[220px] shrink-0 md:block">
        {t('Overall recommendation')}
      </div>
      <SortableHeader
        label={t('Score ({pts}pts)', { pts: totalPoints })}
        column="totalScore"
        active={sortBy === 'totalScore'}
        dir={dir}
        onSortChange={onSortChange}
        className="hidden w-[80px] shrink-0 md:flex"
        underline
      />
      <div className="h-4 w-[110px] shrink-0" aria-hidden />
    </div>
  );
}

function BodyRow({
  item,
  advancing,
  onAdvance,
  advanceLabel,
}: {
  item: Item;
  advancing: boolean;
  onAdvance: () => void;
  advanceLabel: string;
}) {
  const title =
    item.proposalData.title ??
    item.proposalData.description ??
    item.proposalData.content ??
    '';
  const submitterName = item.submittedBy?.name ?? item.profile.name;
  const budget = item.proposalData.budget;
  const counts = countOverallRecommendation(item);

  return (
    <div className="flex w-full items-center justify-between gap-4 border-b border-neutral-gray1 py-2">
      {/* Proposal — title + submitter */}
      <div className="flex w-[220px] shrink-0 flex-col">
        <span className="line-clamp-1 text-sm text-neutral-black">{title}</span>
        <span className="line-clamp-1 text-xs text-neutral-gray4">
          {submitterName}
        </span>
      </div>

      {/* Budget */}
      <div className="hidden w-[60px] shrink-0 text-sm text-neutral-black md:block">
        {budget
          ? formatCurrency(budget.amount, undefined, budget.currency)
          : '—'}
      </div>

      {/* Categories */}
      <CategoryCell categories={item.categories} />

      {/* Overall recommendation: yes / maybe / no */}
      <RecommendationCell counts={counts} />

      {/* Score */}
      <div className="hidden w-[80px] shrink-0 text-sm text-neutral-black md:block">
        <ScoreCell value={item.aggregates.totalScore} />
      </div>

      {/* Advance button */}
      <Button
        size="small"
        color={advancing ? 'primary' : 'secondary'}
        className="w-[110px] shrink-0 justify-center"
        onPress={onAdvance}
      >
        {advanceLabel}
      </Button>
    </div>
  );
}

function CategoryCell({ categories }: { categories: Item['categories'] }) {
  const t = useTranslations();
  const visible = categories.slice(0, 2);
  const extra = categories.length - visible.length;

  if (categories.length === 0) {
    return <div className="hidden w-[220px] shrink-0 md:block" aria-hidden />;
  }

  return (
    <div className="hidden w-[220px] shrink-0 items-center gap-2 md:flex">
      {visible.map((c) => (
        <Chip key={c.id} className="line-clamp-1 text-xs">
          {c.label}
        </Chip>
      ))}
      {extra > 0 && (
        <span className="text-xs text-neutral-gray4">
          {t('+{count} More', { count: extra })}
        </span>
      )}
    </div>
  );
}

function RecommendationCell({
  counts,
}: {
  counts: { yes: number; maybe: number; no: number };
}) {
  const t = useTranslations();

  return (
    <div className="hidden w-[220px] shrink-0 items-center gap-4 text-sm text-neutral-black md:flex">
      <CountLabel
        value={counts.yes}
        label={t('Yes')}
        dot="bg-functional-green"
      />
      <CountLabel
        value={counts.maybe}
        label={t('Maybe')}
        dot="bg-primary-orange1"
      />
      <CountLabel value={counts.no} label={t('No')} dot="bg-functional-red" />
    </div>
  );
}

function CountLabel({
  value,
  label,
  dot,
}: {
  value: number;
  label: string;
  dot: string;
}) {
  return (
    <span className="flex items-center gap-1 text-sm text-neutral-black">
      <RecommendationDot color={dot} />
      {value} {label}
    </span>
  );
}

function RecommendationDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full ${color}`}
    />
  );
}

function ScoreCell({ value }: { value: number }) {
  const t = useTranslations();
  // Render with at most one decimal — most rubrics produce integers but
  // averageScore-derived values can drift; keep the column compact.
  const display = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return <>{t('{pts} pts', { pts: display })}</>;
}

function SortableHeader({
  label,
  column,
  active,
  dir,
  onSortChange,
  className,
  underline = false,
}: {
  label: ReactNode;
  column: SortColumn;
  active: boolean;
  dir: SortDir;
  onSortChange: (sortBy: SortColumn, dir: SortDir) => void;
  className?: string;
  underline?: boolean;
}) {
  const Icon = active && dir === 'asc' ? LuArrowUp : LuArrowDown;

  return (
    <button
      type="button"
      onClick={() => {
        const nextDir: SortDir = active && dir === 'desc' ? 'asc' : 'desc';
        onSortChange(column, nextDir);
      }}
      className={`flex shrink-0 items-center gap-0.5 text-xs text-neutral-gray4 ${className ?? ''}`}
    >
      <span
        className={
          underline ? 'underline decoration-dotted underline-offset-2' : ''
        }
      >
        {label}
      </span>
      <Icon className="size-3" />
    </button>
  );
}

function countOverallRecommendation(item: Item): {
  yes: number;
  maybe: number;
  no: number;
} {
  const counts = { yes: 0, maybe: 0, no: 0 };
  for (const entry of item.aggregates.optionCounts) {
    if (entry.criterionId !== OVERALL_RECOMMENDATION_KEY) {
      continue;
    }
    if (entry.optionKey === 'yes') {
      counts.yes = entry.count;
    } else if (entry.optionKey === 'maybe') {
      counts.maybe = entry.count;
    } else if (entry.optionKey === 'no') {
      counts.no = entry.count;
    }
  }
  return counts;
}
