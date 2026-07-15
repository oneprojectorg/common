import { ProposalFilter } from '@op/api/encoders';

export type ProposalFilterItem = {
  id: ProposalFilter;
  label: string;
  isDisabled?: boolean;
};

// Drops proposal-type options that have nothing to show the current viewer:
// "My proposals" when they've submitted none, "Shortlisted" when nothing is
// shortlisted. The active filter is always kept so the control can never hide
// the option it is currently set to (and leave the user stranded on it).
export const getRelevantProposalFilterItems = ({
  items,
  currentFilter,
  hasOwnProposals,
  hasShortlisted,
}: {
  items: ProposalFilterItem[];
  currentFilter: ProposalFilter;
  hasOwnProposals: boolean;
  hasShortlisted: boolean;
}): ProposalFilterItem[] =>
  items.filter((item) => {
    if (item.id === currentFilter) {
      return true;
    }
    switch (item.id) {
      case ProposalFilter.MY_PROPOSALS:
        return hasOwnProposals;
      case ProposalFilter.SHORTLISTED:
        return hasShortlisted;
      default:
        return true;
    }
  });
