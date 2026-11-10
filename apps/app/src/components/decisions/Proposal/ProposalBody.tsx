'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import type { ProposalSelection } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

import { ProposalPreview, toPreviewEngagement } from '../ProposalPreview';
import { TranslateLink } from '../TranslateLink';
import { useProposal } from './proposalContext';

interface ProposalBodyProps {
  /** Like/follow controls for a viewer who may engage; off shows plain counts. */
  engagement?: boolean;
  selection?: ProposalSelection | null;
  submissionMetaSuffix?: ReactNode;
  headerBanner?: ReactNode;
  className?: string;
  /** Sections after the proposal, e.g. contributing ideas and comments. */
  children?: ReactNode;
}

/**
 * The proposal and the sections after it, in one column. Owns no scroll
 * region or outer padding, so the page, the sheet and the reviewer pane each
 * place it in their own container. Holds no state: everything it shows comes
 * from `ProposalProvider`.
 */
export function ProposalBody({
  engagement = true,
  selection,
  submissionMetaSuffix,
  headerBanner,
  className,
  children,
}: ProposalBodyProps) {
  const { proposal, documentState, translation } = useProposal();
  // Everyone sees the counts; only a signed-in member with engagement access
  // gets the controls (the hook returns undefined otherwise).
  const proposalEngagement = useProposalEngagement({
    proposal,
    canEngage: engagement && canEngageWithProposals(proposal.access),
  });

  return (
    // Each section's own `pt` mirrors this gap, centring the rules between.
    <div className={cn('flex flex-col gap-6 sm:gap-10', className)}>
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
