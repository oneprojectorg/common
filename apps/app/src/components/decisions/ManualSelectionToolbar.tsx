'use client';

import { useTranslations } from '@/lib/i18n';

import { ProposalCount } from './ProposalCount';
import { ResponsiveSelect } from './ResponsiveSelect';
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
    <StickyFilterBar pinOffset={pinOffset}>
      <ProposalCount count={count} />
      <div className="scrollbar-none flex items-center gap-4 max-md:-mx-4 max-md:w-screen max-md:overflow-x-scroll max-md:px-4">
        <ResponsiveSelect
          selectedKey={selectedCategory}
          onSelectionChange={(key) => onChange({ selectedCategory: key })}
          aria-label={t('Filter proposals by category')}
          className="min-w-40"
          items={[
            { id: 'all-categories', label: t('All categories') },
            ...categories.map((category) => ({
              id: category.id,
              label: category.name,
            })),
          ]}
        />
        <ResponsiveSelect
          selectedKey={sortOrder}
          onSelectionChange={(key) => onChange({ sortOrder: key })}
          aria-label={t('Sort proposals')}
          className="min-w-40"
          items={[
            { id: 'votes', label: t('Most votes') },
            { id: 'newest', label: t('Newest First') },
            { id: 'oldest', label: t('Oldest First') },
          ]}
        />
      </div>
    </StickyFilterBar>
  );
};
