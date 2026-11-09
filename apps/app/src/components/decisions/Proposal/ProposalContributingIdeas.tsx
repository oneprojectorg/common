'use client';

import { ContributingIdeas } from '../ContributingIdeas';
import { useProposal } from './proposalContext';

export function ProposalContributingIdeas() {
  const { proposal, decisionRoot } = useProposal();

  return <ContributingIdeas proposal={proposal} decisionRoot={decisionRoot} />;
}
