'use client';

import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import {
  FilterBar,
  FilterBarSelect,
  type FilterBarSelectControl,
} from './FilterBar';

export interface ProposalControls {
  search: string;
  setSearch: (value: string) => void;
  isSearchPending: boolean;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortOrder: string;
  setSortOrder: (sort: string) => void;
  categories: { id: string; name: string }[];
  decisionSlug: string | undefined;
}

export const ProposalsListFilterBar = ({
  pinOffset,
  header,
  controls,
  leadingSelect,
  children,
}: {
  pinOffset?: number;
  header: ReactNode;
  controls: ProposalControls;
  leadingSelect: FilterBarSelectControl;
  children?: ReactNode;
}) => {
  const t = useTranslations();

  return (
    <FilterBar
      pinOffset={pinOffset}
      header={header}
      search={{
        value: controls.search,
        onChange: controls.setSearch,
        isPending: controls.isSearchPending,
        label: t('decisions.proposals.searchProposalsLabel'),
      }}
    >
      <FilterBarSelect {...leadingSelect} />
      <CategoryFilterSelect
        decisionSlug={controls.decisionSlug}
        categories={controls.categories}
        selectedCategory={controls.selectedCategory}
        onSelectCategory={controls.setSelectedCategory}
        className="min-w-40 shrink-0"
      />
      <FilterBarSelect
        label={t('decisions.proposals.sortProposalsLabel')}
        value={controls.sortOrder}
        onChange={controls.setSortOrder}
        items={[
          { id: 'newest', label: t('decisions.proposals.sortNewestOption') },
          { id: 'oldest', label: t('decisions.proposals.sortOldestOption') },
        ]}
      />
      {children}
    </FilterBar>
  );
};
