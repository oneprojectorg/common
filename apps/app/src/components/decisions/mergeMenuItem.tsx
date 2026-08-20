import { LuMerge } from 'react-icons/lu';

import type { ProposalOptionsMenuItem } from './ProposalOptionsMenu';

/**
 * The merge slot both `…` menus render, so the card kebab and the proposal page
 * can't drift. Only the proposal page can undo a merge, so `unmerge` is optional
 * — and the server rejects merging an already-merged proposal, so the two never
 * apply at once.
 */
export function buildMergeMenuItem({
  isDisabled,
  mergeLabel,
  onMerge,
  unmerge,
}: {
  isDisabled: boolean;
  mergeLabel: string;
  onMerge: () => void;
  unmerge?: { isSuperseded: boolean; label: string; onAction: () => void };
}): ProposalOptionsMenuItem {
  return unmerge?.isSuperseded
    ? {
        key: 'unmerge',
        icon: <LuMerge className="size-5" />,
        label: unmerge.label,
        onAction: unmerge.onAction,
        isDisabled,
      }
    : {
        key: 'merge',
        icon: <LuMerge className="size-5" />,
        label: mergeLabel,
        onAction: onMerge,
        isDisabled,
      };
}
