import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { LuMerge } from 'react-icons/lu';

import type { ProposalOptionsMenuItem } from '../ProposalOptionsMenu';
import { resolveProposalSystemFields } from '../proposalContentUtils';

/** One selectable card in the merge dialog's target list. */
export interface MergeCandidate {
  id: string;
  title: string;
  proposal: Proposal;
}

/** A proposal's title is its profile's name, so that's the fallback. */
export function getProposalDisplayTitle(
  proposal: Proposal,
  untitledLabel: string,
): string {
  return (
    resolveProposalSystemFields(proposal).title ||
    proposal.profile.name ||
    untitledLabel
  );
}

/**
 * Combobox input changes that are the field syncing itself to the option the
 * user just chose, rather than the user editing the query. Base UI fills the
 * input from the selection on item press, on inline list navigation, and again
 * when the popup closes (which it reports as `none`).
 */
const MERGE_SEARCH_SELECTION_REASONS = [
  'item-press',
  'list-navigation',
  'none',
];

/**
 * Whether a merge-search input change invalidates the proposal already picked.
 *
 * Only a real edit does: once the field no longer shows the chosen proposal,
 * `Continue` would be merging into something the user can't see.
 */
export function isMergeSearchEdit(reason: string): boolean {
  return !MERGE_SEARCH_SELECTION_REASONS.includes(reason);
}

/**
 * The proposals a given proposal may be merged into, in list order.
 *
 * `mergeProposals` only rejects a self-merge, so the rest is on the picker.
 * Drafts, hidden, and flagged proposals are excluded because merging into one
 * removes the source from every list and leaves nothing visible in its place.
 *
 * Title search is the server's job — `listProposals` takes a `search` term.
 */
export function getMergeCandidates({
  proposals,
  sourceProposalId,
  untitledLabel,
}: {
  proposals: Proposal[];
  sourceProposalId: string;
  untitledLabel: string;
}): MergeCandidate[] {
  return proposals
    .filter(
      (proposal) =>
        proposal.id !== sourceProposalId &&
        proposal.status !== ProposalStatus.DRAFT &&
        proposal.visibility !== Visibility.HIDDEN &&
        !proposal.isFlagged,
    )
    .map((proposal) => ({
      id: proposal.id,
      title: getProposalDisplayTitle(proposal, untitledLabel),
      proposal,
    }));
}

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
