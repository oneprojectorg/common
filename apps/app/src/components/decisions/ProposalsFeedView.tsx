'use client';

import type { Proposal } from '@op/common/client';
import { ProposalFeed, ProposalFeedItem } from '@op/sense/ProposalFeed';
import type { ReactNode } from 'react';

import type { RenderProposalCard } from './ProposalsMapView';

export interface ProposalsFeedViewProps {
  /** Loaded list pages — the feed paginates like the grid and the map do. */
  proposals: Proposal[];
  /** The same card the map's list column renders, so the two can't disagree. */
  renderCard: RenderProposalCard;
  /**
   * Rendered after the last card and inside the feed's own bottom padding —
   * hosts the infinite-scroll sentinel, which is why it goes inside rather than
   * below: the padding is a third of the viewport, so a sentinel underneath it
   * would only trip once the reader had scrolled past the end of the feed.
   */
  listFooter?: ReactNode;
  /** Takes the feed's place when a filter matched nothing. */
  emptyState?: ReactNode;
}

/**
 * Single-column reading view for a set of proposals: one card at a time, the
 * one nearest the centre of the scroll container at full opacity and the rest
 * dimmed by distance (`ProposalFeed` owns that behaviour, including the
 * reduced-motion and keyboard-focus cases).
 */
export function ProposalsFeedView({
  proposals,
  renderCard,
  listFooter,
  emptyState,
}: ProposalsFeedViewProps) {
  if (emptyState && proposals.length === 0) {
    return emptyState;
  }

  return (
    <ProposalFeed>
      {proposals.map((proposal) => (
        <ProposalFeedItem key={proposal.id}>
          {/* `min-w-0` so a long title can't widen the feed column. */}
          {renderCard(proposal, { className: 'min-w-0' })}
        </ProposalFeedItem>
      ))}
      {listFooter && <li>{listFooter}</li>}
    </ProposalFeed>
  );
}
