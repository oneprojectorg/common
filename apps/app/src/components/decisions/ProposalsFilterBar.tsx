'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import { ProposalCount } from './ProposalCount';
import { ProposalSearchField } from './ProposalSearchField';
import { type ProposalView, ProposalViewToggle } from './ProposalViewToggle';
import { ResponsiveSelect } from './ResponsiveSelect';
import { useProposalFilterItems } from './useProposalFilters';

/** The filter state the bar reads and writes, owned by `ProposalsList`. */
export interface ProposalControls {
  search: string;
  setSearch: (value: string) => void;
  /** False on the results tab, whose endpoint can't filter on a search term. */
  canSearch: boolean;
  /** A query is in flight — results on screen are for an earlier term. */
  isSearchPending: boolean;
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortOrder: string;
  setSortOrder: (sort: string) => void;
  categories: { id: string; name: string }[];
  hasVoted: boolean;
  currentProfileId: string | undefined;
  decisionSlug: string | undefined;
}

/** Grid/map switch, present only when the process collects a location. */
export interface ProposalViewControls {
  value: ProposalView;
  onChange: (next: ProposalView) => void;
}

export const ProposalsListHeader = ({
  showCount,
  count,
  total,
}: {
  showCount: boolean;
  count: number;
  total: number;
}) => {
  const t = useTranslations();

  return showCount ? (
    <ProposalCount count={count} total={total} />
  ) : (
    <span className="font-serif text-title">{t('My proposals')}</span>
  );
};

/**
 * Search and the three filter selects, plus the view toggle where the process
 * has one. Search takes a full-width row above the selects on mobile and sits
 * beside them from md up — one instance either way, so focus survives a
 * breakpoint change.
 */
export const ProposalsFilterBar = ({
  controls,
  view,
  exportControl,
}: {
  controls: ProposalControls;
  view?: ProposalViewControls;
  /** Admin-only CSV export control; omitted entirely for non-admins. */
  exportControl?: React.ReactNode;
}) => {
  const t = useTranslations();
  const filterItems = useProposalFilterItems({
    hasVoted: controls.hasVoted,
    currentProfileId: controls.currentProfileId,
  });

  return (
    <div className="flex flex-col gap-4 max-md:w-full md:flex-row md:items-center">
      {controls.canSearch && (
        <ProposalSearchField
          value={controls.search}
          onChange={controls.setSearch}
          isPending={controls.isSearchPending}
        />
      )}
      <div className="scrollbar-none flex items-center gap-4 max-md:-mx-4 max-md:w-screen max-md:overflow-x-scroll max-md:px-4">
        <ResponsiveSelect
          selectedKey={controls.proposalFilter}
          onSelectionChange={(key) => {
            // "My proposals" needs a profile; ignore the pick without one.
            if (
              key === ProposalFilter.MY_PROPOSALS &&
              !controls.currentProfileId
            ) {
              return;
            }
            controls.setProposalFilter(key);
          }}
          aria-label={t('Filter proposals')}
          items={filterItems}
          className="min-w-40"
        />
        <CategoryFilterSelect
          decisionSlug={controls.decisionSlug}
          categories={controls.categories}
          selectedCategory={controls.selectedCategory}
          onSelectCategory={controls.setSelectedCategory}
          className="min-w-40"
        />
        <ResponsiveSelect
          selectedKey={controls.sortOrder}
          onSelectionChange={controls.setSortOrder}
          aria-label={t('Sort proposals')}
          className="min-w-40"
          items={[
            { id: 'newest', label: t('Newest First') },
            { id: 'oldest', label: t('Oldest First') },
          ]}
        />
        {view && (
          <div className="hidden items-center gap-4 sm:flex">
            <span aria-hidden className="h-6 w-px bg-border" />
            <ProposalViewToggle value={view.value} onChange={view.onChange} />
          </div>
        )}
        {exportControl && (
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-6 w-px bg-border" />
            {exportControl}
          </div>
        )}
      </div>
    </div>
  );
};
