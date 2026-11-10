'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import type { ProposalSelection } from '@op/common/client';
import type { ReactNode } from 'react';

import { ProposalPreview, toPreviewEngagement } from '../ProposalPreview';
import { TranslateLink } from '../TranslateLink';
import { useProposal } from './proposalContext';

interface ProposalBodyProps {
  engagement?: boolean;
  selection?: ProposalSelection | null;
  submissionMetaSuffix?: ReactNode;
  headerBanner?: ReactNode;
  children?: ReactNode;
}

export function ProposalBody({
  engagement = true,
  selection,
  submissionMetaSuffix,
  headerBanner,
  children,
}: ProposalBodyProps) {
  const { proposal, documentState, translation } = useProposal();
  const proposalEngagement = useProposalEngagement({
    proposal,
    canEngage: engagement && canEngageWithProposals(proposal.access),
  });

  return (
    // Each section's own `pt` mirrors this gap, centring the rules between.
    <div className="flex flex-col gap-6 sm:gap-10">
      <ProposalPreview
        proposal={proposal}
        documentState={documentState}
        selection={selection}
        engagement={toPreviewEngagement(proposalEngagement)}
        translation={translation.translation}
        translateLink={<TranslateLink translation={translation.link} />}
        submissionMetaSuffix={submissionMetaSuffix}
        headerBanner={headerBanner}
      />

      {children}
    </div>
  );
}
