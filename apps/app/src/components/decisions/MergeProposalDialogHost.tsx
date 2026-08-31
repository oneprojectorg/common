'use client';

import type { Proposal } from '@op/common/client';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

import { MergeProposalDialog } from './MergeProposalDialog';

/** Opens the merge dialog with `proposal` as the one being merged away. */
type OpenMergeProposalDialog = (proposal: Proposal) => void;

const MergeProposalDialogContext =
  createContext<OpenMergeProposalDialog | null>(null);

/**
 * Hosts the one merge dialog a proposal list can have open, above the grid
 * rather than inside the card whose menu opened it.
 *
 * The grid lays its cards out with `react-masonry-css`, which hands child `i`
 * to column `i % columns`. One proposal arriving — a submission from someone
 * else, refetched by channel invalidation — shifts every card into a different
 * column, so React unmounts and remounts all of them. A dialog owned by the
 * card went with it: the modal vanished mid-merge and took the admin's picked
 * target and note along (ONE-1123). Owning it here keeps it mounted through
 * any number of list refreshes.
 */
export function MergeProposalDialogHost({ children }: { children: ReactNode }) {
  // The proposal as it was when the menu opened, held past the close so the
  // dialog animates out rather than disappearing. It no longer tracks the list,
  // which is the point: the merge names the proposal the admin chose, and only
  // its id reaches the mutation.
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openMergeDialog = useCallback((sourceProposal: Proposal) => {
    setProposal(sourceProposal);
    setIsOpen(true);
  }, []);

  return (
    <MergeProposalDialogContext.Provider value={openMergeDialog}>
      {children}
      {proposal ? (
        <MergeProposalDialog
          proposal={proposal}
          open={isOpen}
          onOpenChange={setIsOpen}
        />
      ) : null}
    </MergeProposalDialogContext.Provider>
  );
}

/**
 * Opens the merge dialog for one proposal. Throws outside a
 * {@link MergeProposalDialogHost} — a menu whose Merge item silently did
 * nothing would look like the bug this host exists to fix.
 */
export function useOpenMergeProposalDialog() {
  const openMergeDialog = useContext(MergeProposalDialogContext);

  if (!openMergeDialog) {
    throw new Error(
      'useOpenMergeProposalDialog must be used inside a MergeProposalDialogHost',
    );
  }

  return openMergeDialog;
}
