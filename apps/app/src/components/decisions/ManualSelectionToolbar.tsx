'use client';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import { FilterBarEnd, FilterBarSelect } from './FilterBar';
import { ProposalCount } from './ProposalCount';
import { StickyFilterBar } from './StickyFilterBar';

interface Category {
  id: string;
  name: string;
}

export type SortOrder = 'votes' | 'newest' | 'oldest';

export interface SelectionFilters {
  selectedCategory: string;
  sortOrder: SortOrder;
}

interface ManualSelectionToolbarProps {
  count: number;
  categories: Category[];
  decisionSlug: string;
  filters: SelectionFilters;
  onChange: (patch: Partial<SelectionFilters>) => void;
  /** Px offset where the bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

export const ManualSelectionToolbar = ({
  count,
  categories,
  decisionSlug,
  filters,
  onChange,
  pinOffset,
}: ManualSelectionToolbarProps) => {
  const t = useTranslations();
  const { selectedCategory, sortOrder } = filters;

  return (
    <StickyFilterBar pinOffset={pinOffset}>
      <ProposalCount count={count} />
      <FilterBarEnd>
        <CategoryFilterSelect
          decisionSlug={decisionSlug}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(category) =>
            onChange({ selectedCategory: category })
          }
        />
        <FilterBarSelect
          value={sortOrder}
          onChange={(key) => onChange({ sortOrder: key })}
          label={t('decisions.proposals.sortProposalsLabel')}
          items={[
            { id: 'votes', label: t('decisions.review.sortMostVotes') },
            { id: 'newest', label: t('decisions.proposals.sortNewestOption') },
            { id: 'oldest', label: t('decisions.proposals.sortOldestOption') },
          ]}
        />
      </FilterBarEnd>
    </StickyFilterBar>
  );
};
