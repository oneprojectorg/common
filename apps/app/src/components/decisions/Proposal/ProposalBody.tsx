'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import type { ProposalSelection } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useMemo } from 'react';

import {
  ProposalPreview,
  type ProposalPreviewProps,
  toPreviewEngagement,
} from '../ProposalPreview';
import { TranslateLink } from '../TranslateLink';
import { useLiveProposalDocument } from '../useLiveProposalDocument';
import { useTranslateProposal } from '../useTranslateProposal';
import { ProposalContext, useProposal } from './proposalContext';

interface ProposalBodyProps {
  /**
   * Re-fetches the proposal while its collaboration document propagates, and
   * gives the parts below the fetched proposal. Off where the container holds
   * a fixed version that must not be refetched, e.g. a review assignment.
   */
  live?: boolean;
  /** Like/follow controls for a viewer who may engage; off shows plain counts. */
  engagement?: boolean;
  selection?: ProposalSelection | null;
  submissionMetaSuffix?: ReactNode;
  headerBanner?: ReactNode;
  className?: string;
  /** Sections after the proposal, e.g. contributing ideas and comments. */
  children?: ReactNode;
}

type ProposalBodyContentProps = Omit<ProposalBodyProps, 'live'> &
  Pick<ProposalPreviewProps, 'proposal' | 'documentState'>;

/**
 * The proposal and the sections after it, in one column. Owns no scroll
 * region or outer padding, so the page, the sheet and the reviewer pane each
 * place it in their own container.
 */
export function ProposalBody({ live = true, ...props }: ProposalBodyProps) {
  const { proposal } = useProposal();

  return live ? (
    <LiveProposalBody {...props} />
  ) : (
    <ProposalBodyContent {...props} proposal={proposal} />
  );
}

function LiveProposalBody(props: Omit<ProposalBodyProps, 'live'>) {
  const { proposal: initialProposal, decisionRoot } = useProposal();
  const { proposal, documentState } = useLiveProposalDocument(initialProposal);

  const value = useMemo(
    () => ({ proposal, decisionRoot }),
    [proposal, decisionRoot],
  );

  return (
    <ProposalContext.Provider value={value}>
      <ProposalBodyContent
        {...props}
        proposal={proposal}
        documentState={documentState}
      />
    </ProposalContext.Provider>
  );
}

function ProposalBodyContent({
  proposal,
  documentState,
  engagement = true,
  selection,
  submissionMetaSuffix,
  headerBanner,
  className,
  children,
}: ProposalBodyContentProps) {
  const { link, translation } = useTranslateProposal(proposal);

  const previewProps: ProposalPreviewProps = {
    proposal,
    documentState,
    selection,
    translation,
    translateLink: <TranslateLink translation={link} />,
    submissionMetaSuffix,
    headerBanner,
  };

  return (
    // Each section's own `pt` mirrors this gap, centring the rules between.
    <div className={cn('flex flex-col gap-6 sm:gap-10', className)}>
      {engagement ? (
        <EngagedProposalPreview {...previewProps} />
      ) : (
        <ProposalPreview {...previewProps} />
      )}

      {children}
    </div>
  );
}

/**
 * Everyone sees the counts; only a signed-in member with engagement access
 * gets the controls (the hook returns undefined otherwise).
 */
function EngagedProposalPreview(props: ProposalPreviewProps) {
  const engagement = useProposalEngagement({
    proposal: props.proposal,
    canEngage: canEngageWithProposals(props.proposal.access),
  });

  return (
    <ProposalPreview {...props} engagement={toPreviewEngagement(engagement)} />
  );
}
