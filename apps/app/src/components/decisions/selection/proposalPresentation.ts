import { formatMoney } from '@/utils/formatting';
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
    budgetCurrency,
    category: categories = [],
  } = resolveProposalSystemFields(proposal);
  const title = resolvedTitle || proposal.profile.name || defaultTitle;
  const submitterName = proposal.submittedBy?.name;
  // `budget`, not `budget?.amount` — a budget of 0 is a real answer (the input
  // allows it), and testing the amount for truthiness renders it as no budget
  // at all here while every other surface shows "$0".
  // `budgetCurrency`, not `budget.currency`: the stored budget leaves it absent
  // when the author named none, and this is the resolved answer for the whole
  // proposal — the same one the card beside this one renders with.
  const formattedBudget = budget
    ? formatMoney({ amount: budget.amount, currency: budgetCurrency })
    : null;

  return {
    title,
    submitterName,
    budget: formattedBudget,
    categories,
  };
};
