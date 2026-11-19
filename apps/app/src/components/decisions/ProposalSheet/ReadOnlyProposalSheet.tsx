'use client';

import { ContributingIdeas } from '../ContributingIdeas';
import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalSheetShell } from './ProposalSheetShell';

/** The proposal sheet without engagement or comments. */
export function ReadOnlyProposalSheet() {
  return (
    <ProposalSheetShell>
      <ProposalBody engagement={false}>
        <ContributingIdeas />
      </ProposalBody>
    </ProposalSheetShell>
  );
}
