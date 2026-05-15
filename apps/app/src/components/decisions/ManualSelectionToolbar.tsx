'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { ResponsiveSelect } from './ResponsiveSelect';

interface Category {
  id: string;
  name: string;
}

export type SortOrder = 'votes' | 'newest' | 'oldest';

export interface SelectionFilters {
  proposalFilter: ProposalFilter;
  selectedCategory: string;
  sortOrder: SortOrder;
}

interface ManualSelectionToolbarProps {
  count: number;
  currentProfileId: string | undefined;
  categories: Category[];
  filters: SelectionFilters;
  onChange: (patch: Partial<SelectionFilters>) => void;
}

export const ManualSelectionToolbar = ({
  count,
  currentProfileId,
  categories,
  filters,
  onChange,
}: ManualSelectionToolbarProps) => {
  const t = useTranslations();
  const { proposalFilter, selectedCategory, sortOrder } = filters;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <span className="font-serif text-title-base text-neutral-black">
        {t('All proposals')} <Bullet /> {count}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <ResponsiveSelect
          selectedKey={proposalFilter}
          onSelectionChange={(key) => {
            if (key === ProposalFilter.MY_PROPOSALS && !currentProfileId) {
              return;
            }
            onChange({ proposalFilter: key });
          }}
          aria-label={t('Filter proposals')}
          items={[
            { id: ProposalFilter.ALL, label: t('All proposals') },
            {
              id: ProposalFilter.MY_PROPOSALS,
              label: t('My proposals'),
              isDisabled: !currentProfileId,
            },
            {
              id: ProposalFilter.SHORTLISTED,
              label: t('Shortlisted proposals'),
            },
          ]}
        />
        <ResponsiveSelect
          selectedKey={selectedCategory}
          onSelectionChange={(key) => onChange({ selectedCategory: key })}
          aria-label={t('Filter proposals by category')}
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
          items={[
            { id: 'votes', label: t('Most votes') },
            { id: 'newest', label: t('Newest First') },
            { id: 'oldest', label: t('Oldest First') },
          ]}
        />
      </div>
    </div>
  );
};
