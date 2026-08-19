import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';

import { resolveProposalSystemFields } from './proposalContentUtils';

/** One selectable card in the merge dialog's target list. */
export interface MergeCandidate {
  id: string;
  /** Resolved once here so the footer's toast and the search filter agree on it. */
  title: string;
  /** The card renders the proposal itself — title, author, tags, preview. */
  proposal: Proposal;
}

/**
 * How a proposal is named in the merge dialog, its toasts, and the merge notice
 * — the template's title fragment, falling back to the profile name (a
 * proposal's title *is* its profile's name) and then to `untitledLabel`.
 */
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
 * The proposals a given proposal may be merged into, keeping the order the list
 * query returned them in.
 *
 * The exclusions are the picker's job — `mergeProposals` only rejects a
 * self-merge, and `listProposals` hands an admin more than it should survive:
 * - the proposal being merged;
 * - drafts, because an unsubmitted draft must not become the surviving proposal;
 * - hidden and flagged proposals, which members can't see. Merging into one
 *   removes the source from the list and leaves nothing visible in its place,
 *   and `listProposalRelationships` won't name such a target either, so the
 *   merge notice couldn't offer the way back.
 *
 * A proposal already merged into something else can't appear here — every list
 * read excludes it via `notSuperseded` — so there's nothing to filter for that.
 *
 * `searchTerm` narrows by title. It only sees the pages already fetched:
 * `ListProposalsInput` declares a `search` field that nothing reads, so there is
 * no server-side filter to defer to yet.
 */
export function getMergeCandidates({
  proposals,
  sourceProposalId,
  untitledLabel,
  searchTerm = '',
}: {
  proposals: Proposal[];
  sourceProposalId: string;
  /** Fallback for a proposal carrying neither a title field nor a profile name. */
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
