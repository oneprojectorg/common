'use client';

import { ProposalComments } from '../ProposalComments';
import { useCommentsAllowed } from '../useCommentsAllowed';
import { useSheetProposal } from './useSheetProposal';

export function ProposalSheetComments({
  hideHeading,
}: {
  hideHeading?: boolean;
}) {
  const { proposal, decisionRoot } = useSheetProposal();
  const commentsEnabled = useCommentsAllowed(proposal.processInstanceId);

  return commentsEnabled ? (
    <ProposalComments
      proposal={proposal}
      decisionRoot={decisionRoot}
      hideHeading={hideHeading}
    />
  ) : null;
}
