'use client';

import { useTranslations } from '@/lib/i18n';

import { FilterBar, FilterBarEnd, FilterBarSelect } from './FilterBar';
import { ProposalCount } from './ProposalCount';

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
  filters: SelectionFilters;
  onChange: (patch: Partial<SelectionFilters>) => void;
  /** Px offset where the bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

export const ManualSelectionToolbar = ({
  count,
  categories,
  filters,
  onChange,
  pinOffset,
}: ManualSelectionToolbarProps) => {
  const t = useTranslations();
  const { selectedCategory, sortOrder } = filters;

  return (
    <FilterBar pinOffset={pinOffset}>
      <ProposalCount count={count} />
      <FilterBarEnd>
        <FilterBarSelect
          value={selectedCategory}
          onChange={(key) => onChange({ selectedCategory: key })}
          label={t('decisions.proposals.filterByCategoryLabel')}
          items={[
            {
              id: 'all-categories',
              label: t('decisions.proposals.allCategoriesOption'),
            },
            ...categories.map((category) => ({
              id: category.id,
              label: category.name,
            })),
          ]}
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
    </FilterBar>
  );
};
