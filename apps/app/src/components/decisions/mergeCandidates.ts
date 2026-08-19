import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';

import { resolveProposalSystemFields } from './proposalContentUtils';

/** One selectable row in the merge dialog's target list. */
export interface MergeCandidate {
  id: string;
  title: string;
  /** Submitter display name; absent for an anonymous or missing submitter. */
  authorName?: string;
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
 */
export function getMergeCandidates({
  proposals,
  sourceProposalId,
  untitledLabel,
}: {
  proposals: Proposal[];
  sourceProposalId: string;
  /** Fallback for a proposal carrying neither a title field nor a profile name. */
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
    .map((proposal) => {
      const title = getProposalDisplayTitle(proposal, untitledLabel);
      const authorName =
        proposal.submittedBy && !proposal.submittedBy.isAnonymous
          ? proposal.submittedBy.name
          : '';

      return {
        id: proposal.id,
        title,
        ...(authorName ? { authorName } : {}),
      };
    });
}
