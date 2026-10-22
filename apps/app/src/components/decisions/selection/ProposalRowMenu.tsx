'use client';

import type { Proposal } from '@op/common/client';

import { ProposalCardMenu } from '../ProposalCard/ProposalCardMenu';

/** The proposal card's `…` menu at the end of an advance table row, shown on row hover. */
export const ProposalRowMenu = ({
  proposal,
  proposalHref,
  isSelected,
}: {
  proposal: Proposal;
  proposalHref?: string;
  isSelected: boolean;
}) => {
  // Merging or deleting a selected proposal would leave it in the selection.
  if (isSelected) {
    return null;
  }

  return (
    <div className="transition-opacity motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-aria-expanded:opacity-100">
      <ProposalCardMenu
        proposal={proposal}
        editHref={proposalHref && `${proposalHref}/edit`}
        canManage
        triggerProps={{ variant: 'secondary', size: 'icon' }}
      />
    </div>
  );
};
