'use client';

import { ContributingIdeas } from '../ContributingIdeas';
import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalCommentsSection } from '../Proposal/ProposalCommentsSection';
import { ProposalSheetShell } from './ProposalSheetShell';

export function ProposalSheet() {
  return (
    <ProposalSheetShell>
      <ProposalBody>
        <ContributingIdeas />
        <ProposalCommentsSection />
      </ProposalBody>
    </ProposalSheetShell>
  );
}
