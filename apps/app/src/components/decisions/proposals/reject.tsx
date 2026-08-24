import { LuX } from 'react-icons/lu';

import type { ProposalOptionsMenuItem } from '../ProposalOptionsMenu';

/**
 * The reject slot both `…` menus render, so the card kebab and the proposal page
 * can't drift. Sits alongside {@link buildMergeMenuItem} in Figma's flyout.
 */
export function buildRejectMenuItem({
  isDisabled,
  label,
  onReject,
}: {
  isDisabled: boolean;
  label: string;
  onReject: () => void;
}): ProposalOptionsMenuItem {
  return {
    key: 'reject',
    icon: <LuX className="size-5" />,
    label,
    onAction: onReject,
    isDisabled,
  };
}
