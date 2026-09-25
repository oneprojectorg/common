'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import { ProposalCount } from './ProposalCount';
import { ProposalSearchField } from './ProposalSearchField';
import { ProposalViewToggle } from './ProposalViewToggle';
import { ResponsiveSelect } from './ResponsiveSelect';
import type { ProposalView } from './proposalViews';

/** The filter state the bar reads and writes, owned by `ProposalsList`. */
export interface ProposalControls {
  search: string;
  setSearch: (value: string) => void;
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

/** Browse-view switch, present only when there is more than one view to be in. */
export interface ProposalViewControls {
  value: ProposalView;
  /** The views to offer, in display order — see `useProposalViewMode`. */
  views: readonly ProposalView[];
  onChange: (next: ProposalView) => void;
}

/**
 * The view toggle and the rule that sets it off from whatever precedes it.
 * Shared so the switch survives the filter-less bar — a phase that hides
 * proposals drops the filters, and dropping the way out of a view with them
 * strands whoever arrived on a `?view=` link.
 */
export const ProposalsViewSwitch = ({
  view,
}: {
  view: ProposalViewControls;
}) => (
  <div className="flex items-center gap-4">
    <span aria-hidden className="h-6 w-px bg-border" />
    <ProposalViewToggle
      value={view.value}
      views={view.views}
      onChange={view.onChange}
    />
  </div>
);

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

  return (
    <span className="font-serif text-title">
      {t('decisions.proposals.myProposalsOption')}
    </span>
  );
};

/**
 * The count and search on one side, the filter selects and the view switch on
 * the other — the switch sits at the end of the selects at every width, which
 * is the arrangement the design asks for.
 *
 * Two boxes rather than one wrapping row, so the split is an element boundary
 * and not a measurement: below `2xl` the count box takes a full row and the
 * selects drop beneath it, right-aligned; from `2xl` it grows instead, putting
 * everything on one line. Inside the box, `ms-auto` holds search to the end,
 * and below `md` the field's `w-full` wraps it under the count. One search
 * instance and one switch at every width, so focus survives a breakpoint
 * change.
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
  // Every option maps to a server-side query param in ProposalsList's
  // queryParams, so pagination and counts stay accurate.
  const filterItems = [
    {
      id: ProposalFilter.ALL,
      label: t('decisions.proposals.allProposalsOption'),
    },
    {
      id: ProposalFilter.MY_PROPOSALS,
      label: t('decisions.proposals.myProposalsOption'),
      isDisabled: !controls.currentProfileId,
    },
    ...(controls.hasVoted
      ? [
          {
            id: ProposalFilter.MY_BALLOT,
            label: t('decisions.proposals.myBallotOption'),
          },
        ]
      : []),
    {
      id: ProposalFilter.REJECTED,
      label: t('decisions.proposals.notAdvancedStatus'),
    },
  ];

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
      {/* Grows to claim its row below 2xl; at 2xl it's content-width beside
          the count. Wraps rather than scrolls: a select reachable only by
          dragging the row sideways is a select nobody finds. */}
      <div className="flex flex-wrap items-center justify-end gap-4 max-2xl:grow">
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
          aria-label={t('decisions.proposals.filterProposalsLabel')}
          items={filterItems}
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
        {view && <ProposalsViewSwitch view={view} />}
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
