'use client';

import { ProposalComments } from '../ProposalComments';
import { useCommentsAllowed } from '../useCommentsAllowed';
import { useProposal } from './proposalContext';

/** The proposal's comments, when its current phase allows them. */
export function ProposalCommentsSection({
  readOnly,
  hideHeading,
}: {
  readOnly?: boolean;
  /** For a container that already names and separates the section, e.g. a tab. */
  hideHeading?: boolean;
}) {
  const { proposal, decisionRoot } = useProposal();
  const commentsEnabled = useCommentsAllowed(proposal.processInstanceId);

  return commentsEnabled ? (
    <ProposalComments
      proposal={proposal}
      decisionRoot={decisionRoot}
      readOnly={readOnly}
      hideHeading={hideHeading}
    />
  ) : null;
}
