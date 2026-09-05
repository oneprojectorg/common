'use client';

import type { Proposal } from '@op/common/client';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { MergeProposalDialog } from './MergeProposalDialog';
import { DeleteProposalDialog } from './ProposalCard/DeleteProposalDialog';
import { RejectProposalDialog } from './RejectProposalDialog';
import { useProposalRejectionActions } from './useProposalRejectionActions';

/** The dialogs the proposal card's "…" menu opens, hosted above the grid. */
interface ProposalCardDialogs {
  /** `proposal` is the one being merged away, not the target. */
  openMergeDialog: (proposal: Proposal) => void;
  openRejectDialog: (proposal: Proposal) => void;
  openDeleteDialog: (proposal: Proposal) => void;
}

const ProposalCardDialogContext = createContext<ProposalCardDialogs | null>(
  null,
);

/**
 * Owns the dialogs a proposal list can have open, above the grid rather than
 * inside the card whose menu opened them.
 *
 * The grid lays its cards out with `react-masonry-css`, which hands child `i`
 * to column `i % columns`. One proposal arriving — a submission from someone
 * else, refetched by channel invalidation — shifts every card into a different
 * column, so React unmounts and remounts all of them. A dialog owned by the
 * card went with it: the modal vanished mid-merge and took the admin's picked
 * target along (ONE-1123), and mid-reject took the chosen reason and the note
 * they had typed (ONE-1231). Owning them here keeps them mounted through any
 * number of list refreshes.
 *
 * Context rather than `onMerge` / `onReject` / `onDelete` props for the same
 * reason {@link ProposalReviewDecorationProvider} exists: the list, grid, map
 * and card components in between are proposal-agnostic, and threading three
 * callbacks through all four would undo that.
 */
export function ProposalCardDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const merge = useHostedProposalDialog();
  const reject = useHostedProposalDialog();
  const deletion = useHostedProposalDialog();

  // The openers are stable, so this is built once — every card reads it.
  const dialogs = useMemo<ProposalCardDialogs>(
    () => ({
      openMergeDialog: merge.open,
      openRejectDialog: reject.open,
      openDeleteDialog: deletion.open,
    }),
    [merge.open, reject.open, deletion.open],
  );

  return (
    <ProposalCardDialogContext.Provider value={dialogs}>
      {children}
      {merge.proposal ? (
        <MergeProposalDialog
          proposal={merge.proposal}
          open={merge.isOpen}
          onOpenChange={merge.setIsOpen}
        />
      ) : null}
      {reject.proposal ? (
        <HostedRejectProposalDialog
          proposal={reject.proposal}
          open={reject.isOpen}
          onOpenChange={reject.setIsOpen}
        />
      ) : null}
      {deletion.proposal ? (
        <DeleteProposalDialog
          proposalId={deletion.proposal.id}
          open={deletion.isOpen}
          onOpenChange={deletion.setIsOpen}
        />
      ) : null}
    </ProposalCardDialogContext.Provider>
  );
}

/**
 * The card menu's dialog openers. Throws without a provider, like
 * {@link useSetDecisionTranslation} — a menu item that silently did nothing
 * would look like the bug this provider exists to fix.
 */
export function useProposalCardDialogs() {
  const dialogs = useContext(ProposalCardDialogContext);

  if (!dialogs) {
    throw new Error(
      'useProposalCardDialogs must be used within a ProposalCardDialogProvider',
    );
  }

  return dialogs;
}

/**
 * One hosted dialog's state: which proposal it was opened for, and whether it
 * is open. The proposal is held past the close so the dialog animates out
 * rather than disappearing. It no longer tracks the list, which is the point:
 * the action names the proposal the admin chose, and only its id reaches the
 * mutation.
 */
function useHostedProposalDialog() {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((target: Proposal) => {
    setProposal(target);
    setIsOpen(true);
  }, []);

  return { proposal, isOpen, setIsOpen, open };
}

/**
 * Wraps the reject dialog with the mutation it confirms.
 * `useProposalRejectionActions` needs a proposal and a hook cannot be called
 * conditionally, so it lives in a child that mounts only once one is picked.
 */
function HostedRejectProposalDialog({
  proposal,
  open,
  onOpenChange,
}: {
  proposal: Proposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { reject, isRejecting } = useProposalRejectionActions(proposal);

  return (
    <RejectProposalDialog
      open={open}
      onOpenChange={onOpenChange}
      isPending={isRejecting}
      onConfirm={(input) =>
        reject(input, { onSuccess: () => onOpenChange(false) })
      }
    />
  );
}
