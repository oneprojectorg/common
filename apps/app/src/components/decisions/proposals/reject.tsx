import { LuRotateCcw, LuX } from 'react-icons/lu';

import type { ProposalOptionsMenuItem } from '../ProposalOptionsMenu';

/**
 * The reject slot both `…` menus render, so the card kebab and the proposal page
 * can't drift. Toggles to "Undo rejection" once the proposal is rejected — the
 * same toggle pattern {@link buildMergeMenuItem} uses for merge/unmerge, so undo
 * lives in exactly the place reject did.
 */
export function buildRejectMenuItem({
  isDisabled,
  isRejected,
  rejectLabel,
  undoLabel,
  onReject,
  onUndo,
}: {
  isDisabled: boolean;
  isRejected: boolean;
  rejectLabel: string;
  undoLabel: string;
  onReject: () => void;
  onUndo: () => void;
}): ProposalOptionsMenuItem {
  return isRejected
    ? {
        key: 'undo-reject',
        icon: <LuRotateCcw className="size-5" />,
        label: undoLabel,
        onAction: onUndo,
        isDisabled,
      }
    : {
        key: 'reject',
        icon: <LuX className="size-5" />,
        label: rejectLabel,
        onAction: onReject,
        isDisabled,
      };
}
