import { LuMerge } from 'react-icons/lu';

import type { ProposalOptionsMenuItem } from './ProposalOptionsMenu';

/**
 * The merge slot both `…` menus render, so the card kebab and the proposal page
 * can't drift. Offers the undo once superseded — the server rejects merging a
 * proposal that already has an outgoing edge, so the two never apply at once.
 */
export function buildMergeMenuItem({
  isSuperseded = false,
  isDisabled,
  mergeLabel,
  unmergeLabel,
  onMerge,
  onUnmerge,
}: {
  isSuperseded?: boolean;
  isDisabled: boolean;
  mergeLabel: string;
  unmergeLabel: string;
  onMerge: () => void;
  onUnmerge?: () => void;
}): ProposalOptionsMenuItem {
  return isSuperseded && onUnmerge
    ? {
        key: 'unmerge',
        icon: <LuMerge className="size-5" />,
        label: unmergeLabel,
        onAction: onUnmerge,
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
