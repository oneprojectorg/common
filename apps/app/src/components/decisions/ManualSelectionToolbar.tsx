'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { ResponsiveSelect } from './ResponsiveSelect';

interface Category {
  id: string;
  name: string;
}

interface ManualSelectionToolbarProps {
  count: number;
  currentProfileId: string | undefined;
  categories: Category[];
  proposalFilter: ProposalFilter;
  setProposalFilter: (key: ProposalFilter) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortOrder: 'newest' | 'oldest';
  setSortOrder: (order: 'newest' | 'oldest') => void;
}

export const ManualSelectionToolbar = ({
  count,
  currentProfileId,
  categories,
  proposalFilter,
  setProposalFilter,
  selectedCategory,
  setSelectedCategory,
  sortOrder,
  setSortOrder,
}: ManualSelectionToolbarProps) => {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <span className="font-serif text-title-base text-foreground">
        {t('All proposals')} <Bullet /> {count}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <ResponsiveSelect
          selectedKey={proposalFilter}
          onSelectionChange={(key) => {
            if (key === ProposalFilter.MY_PROPOSALS && !currentProfileId) {
              return;
            }
            setProposalFilter(key);
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
          onSelectionChange={setSelectedCategory}
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
          onSelectionChange={setSortOrder}
          aria-label={t('Sort proposals')}
          items={[
            { id: 'newest', label: t('Newest First') },
            { id: 'oldest', label: t('Oldest First') },
          ]}
        />
      </div>
    </div>
  );
};
