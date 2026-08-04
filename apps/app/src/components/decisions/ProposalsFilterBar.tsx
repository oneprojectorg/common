'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import { ProposalCount } from './ProposalCount';
import { ResponsiveSelect } from './ResponsiveSelect';
import { useProposalFilterItems } from './useProposalFilters';

export const ProposalsListHeader = ({
  hideFilters,
  count,
  total,
}: {
  hideFilters: boolean;
  count: number;
  total: number;
}) => {
  const t = useTranslations();
  if (hideFilters) {
    return (
      <span className="font-serif text-title-base text-neutral-black">
        {t('My proposals')}
      </span>
    );
  }
  return <ProposalCount count={count} total={total} />;
};

// fallow-ignore-next-line complexity
export const ProposalsFilterBar = ({
  hasVoted,
  currentProfileId,
  proposalFilter,
  setProposalFilter,
  decisionSlug,
  categories,
  selectedCategory,
  onSelectCategory,
  sortOrder,
  onSelectSort,
}: {
  hasVoted: boolean;
  currentProfileId: string | undefined;
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  decisionSlug: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  sortOrder: string;
  onSelectSort: (sort: string) => void;
}) => {
  const t = useTranslations();
  const filterItems = useProposalFilterItems({ hasVoted, currentProfileId });

  return (
    <>
      <ResponsiveSelect
        selectedKey={proposalFilter}
        onSelectionChange={(key) => {
          if (key === ProposalFilter.MY_PROPOSALS && !currentProfileId) {
            return;
          }
          setProposalFilter(key);
        }}
        aria-label={t('Filter proposals')}
        items={filterItems}
        className="min-w-40"
      />
      <CategoryFilterSelect
        decisionSlug={decisionSlug}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        className="min-w-40"
      />
      <ResponsiveSelect
        selectedKey={sortOrder}
        onSelectionChange={onSelectSort}
        aria-label={t('Sort proposals')}
        className="min-w-40"
        items={[
          { id: 'newest', label: t('Newest First') },
          { id: 'oldest', label: t('Oldest First') },
        ]}
      />
    </>
  );
};
