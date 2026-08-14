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

  return (
    // Filtering swaps the results in place, so the count is the only feedback a
    // screen reader gets that a search or filter landed. Announce it.
    <span role="status" aria-live="polite">
      {showCount ? (
        <ProposalCount count={count} total={total} />
      ) : (
        <span className="font-serif text-title">{t('My proposals')}</span>
      )}
    </span>
  );
};

/**
 * The count and search on one side, the three filter selects and the view
 * toggle on the other.
 *
 * Two boxes rather than one wrapping row, so the split is an element boundary
 * and not a measurement: below `xl` the count/search box takes a full row and
 * the selects drop beneath it, right-aligned by `ms-auto`; from `xl` it grows
 * instead, putting everything on one line with search against the selects.
 * Inside the box, `ms-auto` holds search to the end, and below `lg` its
 * `w-full` wraps it under the count while the selects break out edge-to-edge
 * and scroll. One search instance at every width, so focus survives a
 * breakpoint change.
 */
export const ProposalsFilterBar = ({
  controls,
  view,
  count,
  total,
  header,
  exportControl,
}: {
  controls: ProposalControls;
  view?: ProposalViewControls;
  /** Server count for the active filter. */
  count: number;
  /** Unfiltered count for the phase — the "of N" pool. */
  total: number;
  /** Replaces the count — e.g. the admin review title. */
  header?: React.ReactNode;
  /** Admin-only CSV export control; omitted entirely for non-admins. */
  exportControl?: React.ReactNode;
}) => {
  const t = useTranslations();
  const filterItems = useProposalFilterItems({
    hasVoted: controls.hasVoted,
    currentProfileId: controls.currentProfileId,
  });

  return (
    <>
      {/* `w-full` claims a row of its own, so the selects always wrap beneath;
          from 2xl it grows instead, taking the slack that pushes search to the
          end and putting both boxes on one line. */}
      <div className="flex flex-wrap items-center justify-between gap-4 max-2xl:w-full 2xl:flex-1">
        {header ?? (
          <ProposalsListHeader showCount count={count} total={total} />
        )}
        {controls.canSearch && (
          <ProposalSearchField
            className="ms-auto"
            value={controls.search}
            onChange={controls.setSearch}
            isPending={controls.isSearchPending}
          />
        )}
      </div>
      {/* `w-full` below 2xl so the selects' own `ms-auto` has slack to push
          against; at 2xl the box is content-width and sits beside the count. */}
      <div className="-mx-4 scrollbar-none flex items-center gap-4 overflow-x-scroll px-4 max-2xl:w-full sm:-mx-8 sm:px-8">
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
          className="ms-auto min-w-40 shrink-0"
        />
        <CategoryFilterSelect
          decisionSlug={controls.decisionSlug}
          categories={controls.categories}
          selectedCategory={controls.selectedCategory}
          onSelectCategory={controls.setSelectedCategory}
          className="min-w-40 shrink-0"
        />
        <ResponsiveSelect
          selectedKey={controls.sortOrder}
          onSelectionChange={controls.setSortOrder}
          aria-label={t('Sort proposals')}
          className="min-w-40 shrink-0"
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
    </>
  );
};
