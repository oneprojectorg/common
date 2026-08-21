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
