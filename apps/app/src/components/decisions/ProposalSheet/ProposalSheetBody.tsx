'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import type { ReactNode } from 'react';

import { ContributingIdeas } from '../ContributingIdeas';
import { ProposalPreview, toPreviewEngagement } from '../ProposalPreview';
import { TranslateLink } from '../TranslateLink';
import { useLiveProposalDocument } from '../useLiveProposalDocument';
import { useTranslateProposal } from '../useTranslateProposal';
import { useSheetProposal } from './useSheetProposal';

/** The sheet's scroll region: the proposal, then what the call site adds below it. */
export function ProposalSheetBody({ children }: { children?: ReactNode }) {
  const { proposal: initialProposal, decisionRoot } = useSheetProposal();

  const { proposal, documentState } = useLiveProposalDocument(initialProposal);

  const engagement = useProposalEngagement({
    proposal,
    canEngage: canEngageWithProposals(proposal.access),
  });
  const { link, translation } = useTranslateProposal(proposal);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Each section's own `pt` mirrors this gap, centring the rules between. */}
      <div className="flex flex-col gap-6 px-4 py-6 sm:gap-10 sm:px-8 sm:py-8">
        <ProposalPreview
          proposal={proposal}
          documentState={documentState}
          engagement={toPreviewEngagement(engagement)}
          translation={translation}
          translateLink={<TranslateLink translation={link} />}
        />

        <ContributingIdeas proposal={proposal} decisionRoot={decisionRoot} />

        {children}
      </div>
    </div>
  );
}
