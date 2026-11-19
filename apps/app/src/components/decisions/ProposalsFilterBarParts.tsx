'use client';

import { Header3 } from '@op/sense/Header';

import { useTranslations } from '@/lib/i18n';

import { FilterBarActions } from './FilterBar';
import { ProposalCount } from './ProposalCount';
import { ProposalViewToggle } from './ProposalViewToggle';
import type { ProposalView } from './proposalViews';

interface ProposalViewControls {
  value: ProposalView;
  views: readonly ProposalView[];
  onChange: (next: ProposalView) => void;
}

// Desktop-only: below `sm` the floating `MobileViewSwitch` takes its place.
export const ProposalsViewSwitch = ({
  view,
}: {
  view: ProposalViewControls;
}) => (
  <FilterBarActions className="hidden sm:flex">
    <ProposalViewToggle
      value={view.value}
      views={view.views}
      onChange={view.onChange}
    />
  </FilterBarActions>
);

export const ProposalsListHeader = ({
  count,
  total,
}: {
  count: number;
  total: number;
}) => (
  // The count is the only feedback a screen reader gets that a filter landed.
  <span role="status" aria-live="polite">
    <ProposalCount count={count} total={total} />
  </span>
);

export const MyProposalsHeader = () => {
  const t = useTranslations();

  return <Header3>{t('decisions.proposals.myProposalsOption')}</Header3>;
};
