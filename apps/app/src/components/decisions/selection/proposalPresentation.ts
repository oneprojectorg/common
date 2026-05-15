import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';

import { resolveProposalSystemFields } from '../proposalContentUtils';

/**
 * Projects a {@link Proposal} onto the fields the selection UI actually renders
 * (title with fallbacks, submitter name, formatted budget, category list).
 *
 * Lives outside any single view because both the selection table and the
 * confirm-dialog cards consume the same shape.
 */
export const resolvePresentationFields = ({
  proposal,
  defaultTitle,
}: {
  proposal: Proposal;
  defaultTitle: string;
}) => {
  const {
    title: resolvedTitle,
    budget,
    category: categories = [],
  } = resolveProposalSystemFields(proposal);
  const title = resolvedTitle || proposal.profile.name || defaultTitle;
  const submitterName = proposal.submittedBy?.name;
  const formattedBudget = budget?.amount
    ? formatCurrency(budget.amount, undefined, budget.currency)
    : null;

  return {
    title,
    submitterName,
    budget: formattedBudget,
    categories,
  };
};
