import { ProposalStatus } from '@op/api/encoders';
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
 * Two exclusions, both of which the picker must apply itself:
 * - the proposal being merged, because `mergeProposals` rejects a self-merge;
 * - drafts, because an unsubmitted draft must not become the surviving
 *   proposal. Admins and owners do receive drafts from `listProposals`.
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
        proposal.status !== ProposalStatus.DRAFT,
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
