import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';

import { resolveProposalSystemFields } from './proposalContentUtils';

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
 * `searchTerm` only sees the pages already fetched — `ListProposalsInput`
 * declares a `search` field that nothing reads yet.
 */
export function getMergeCandidates({
  proposals,
  sourceProposalId,
  untitledLabel,
  searchTerm = '',
}: {
  proposals: Proposal[];
  sourceProposalId: string;
  untitledLabel: string;
  searchTerm?: string;
}): MergeCandidate[] {
  const query = searchTerm.trim().toLocaleLowerCase();

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
    }))
    .filter(
      (candidate) =>
        !query || candidate.title.toLocaleLowerCase().includes(query),
    );
}
