'use client';

import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalCommentsSection } from '../Proposal/ProposalCommentsSection';
import { ProposalContributingIdeas } from '../Proposal/ProposalContributingIdeas';
import { ProposalSheetShell } from './ProposalSheetShell';

/**
 * A proposal read in a panel over the page it was opened from, so the list's
 * filters, scroll position and map viewport survive the read. Renders nothing
 * without a `ProposalSheetProvider` above, or on a phone.
 */
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
