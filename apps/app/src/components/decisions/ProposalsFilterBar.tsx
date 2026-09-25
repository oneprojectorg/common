'use client';

import { Header3 } from '@op/sense/Header';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import { ProposalCount } from './ProposalCount';
import { ProposalSearchField } from './ProposalSearchField';
import { type ProposalView, ProposalViewToggle } from './ProposalViewToggle';
import { ResponsiveSelect } from './ResponsiveSelect';

/** The proposal filter, or the status axis where a tab bar owns the filter. */
export interface ProposalSelectControl {
  items: { id: string; label: string; isDisabled?: boolean }[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name. */
  label: string;
}

/** The filter state the bar reads and writes, owned by `ProposalsList`. */
export interface ProposalControls {
  search: string;
  setSearch: (value: string) => void;
  /** A query is in flight — results on screen are for an earlier term. */
  isSearchPending: boolean;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortOrder: string;
  setSortOrder: (sort: string) => void;
  categories: { id: string; name: string }[];
  decisionSlug: string | undefined;
}

/** Grid/map switch, present only when the process collects a location. */
export interface ProposalViewControls {
  value: ProposalView;
  onChange: (next: ProposalView) => void;
}

export const ProposalsListHeader = ({
  count,
  total,
}: {
  count: number;
  total: number;
}) => (
  // Filtering swaps the results in place, so the count is the only feedback a
  // screen reader gets that a search or filter landed. Announce it.
  <span role="status" aria-live="polite">
    <ProposalCount count={count} total={total} />
  </span>
);

/**
 * Stands in for the count where the phase hides proposals from non-admins:
 * there is nothing to count that the reader is allowed to see, and no filters
 * to change it, so it is a plain label rather than a live region.
 */
export const MyProposalsHeader = () => {
  const t = useTranslations();

  return <Header3>{t('decisions.proposals.myProposalsOption')}</Header3>;
};

/**
 * The count and search on one side, the three filter selects and the view
 * toggle on the other.
 *
 * Two boxes rather than one wrapping row, so the split is an element boundary
 * and not a measurement: below `2xl` the count/search box takes a full row and
 * the selects drop beneath it, right-aligned by `ms-auto`; from `2xl` it grows
 * instead, putting everything on one line with search against the selects.
 * Inside the box, `ms-auto` holds search to the end, and below `md` the field's
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
  leadingSelect,
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
  leadingSelect: ProposalSelectControl;
}) => {
  const t = useTranslations();

  return (
    <>
      {/* `w-full` claims a row of its own, so the selects always wrap beneath;
          from 2xl it grows instead, taking the slack that pushes search to the
          end and putting both boxes on one line. */}
      <div className="flex flex-wrap items-center justify-between gap-4 max-2xl:w-full 2xl:flex-1">
        {header ?? <ProposalsListHeader count={count} total={total} />}
        <ProposalSearchField
          className="ms-auto"
          value={controls.search}
          onChange={controls.setSearch}
          isPending={controls.isSearchPending}
        />
      </div>
      {/* Grows to claim its row below 2xl so `ms-auto` has slack to push
          against; `grow` not `w-full`, since only an auto width absorbs the
          negative margins that bleed this box past the container.
          The auto margin sits on the row's first child rather than a named
          control, and beats `justify-end` because it collapses to zero once the
          row overflows instead of stranding the leading control. */}
      <div className="-mx-4 scrollbar-none flex items-center gap-4 overflow-x-scroll px-4 max-2xl:grow sm:-mx-8 sm:px-8 [&>*:first-child]:ms-auto">
        <ResponsiveSelect
          selectedKey={leadingSelect.value}
          onSelectionChange={leadingSelect.onChange}
          aria-label={leadingSelect.label}
          items={leadingSelect.items}
          className="min-w-40 shrink-0"
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
          aria-label={t('decisions.proposals.sortProposalsLabel')}
          className="min-w-40 shrink-0"
          items={[
            { id: 'newest', label: t('decisions.proposals.sortNewestOption') },
            { id: 'oldest', label: t('decisions.proposals.sortOldestOption') },
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
