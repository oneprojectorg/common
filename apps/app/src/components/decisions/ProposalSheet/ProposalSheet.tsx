'use client';

import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalCommentsSection } from '../Proposal/ProposalCommentsSection';
import { ProposalContributingIdeas } from '../Proposal/ProposalContributingIdeas';
import { ProposalSheetShell } from './ProposalSheetShell';

export function ProposalSheet() {
  return (
    <ProposalSheetShell>
      <ProposalBody>
        <ProposalContributingIdeas />
        <ProposalCommentsSection />
      </ProposalBody>
    </ProposalSheetShell>
  );
}
