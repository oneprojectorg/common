'use client';

import { ProposalComments } from '../ProposalComments';
import { useCommentsAllowed } from '../useCommentsAllowed';
import { useProposal } from './proposalContext';

export function ProposalCommentsSection({ readOnly }: { readOnly?: boolean }) {
  const { proposal, decisionRoot } = useProposal();
  const commentsEnabled = useCommentsAllowed(proposal.processInstanceId);

  return commentsEnabled ? (
    <ProposalComments
      proposal={proposal}
      decisionRoot={decisionRoot}
      readOnly={readOnly}
    />
  ) : null;
}
