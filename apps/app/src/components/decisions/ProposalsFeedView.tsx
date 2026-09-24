'use client';

import type { Proposal } from '@op/common/client';
import { ProposalFeed, ProposalFeedItem } from '@op/sense/ProposalFeed';
import type { ReactNode } from 'react';

import type { RenderProposalCard } from './proposalViews';

export interface ProposalsFeedViewProps {
  /** Loaded list pages — the feed paginates like the grid and the map do. */
  proposals: Proposal[];
  /** The same card the map's list column renders, so the two can't disagree. */
  renderCard: RenderProposalCard;
  /**
   * Rendered as the feed's last list item — hosts the infinite-scroll sentinel.
   * Null once there is no next page to fetch.
   */
  listFooter: ReactNode;
  /** Takes the feed's place when a filter matched nothing. */
  emptyState: ReactNode;
}

// `min-w-0` so a long title can't widen the feed column.
const CARD_OPTIONS = { className: 'min-w-0' };

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
  if (proposals.length === 0) {
    return emptyState;
  }

  return (
    // `centerFirstAndLast` pads the list by a third of the scroll container so
    // the end cards can reach the focal centre. In the browse page that reads
    // as the whole feed being pushed down away from the filter bar, so the
    // cards start where the grid's would.
    <ProposalFeed centerFirstAndLast={false}>
      {proposals.map((proposal) => (
        <ProposalFeedItem key={proposal.id}>
          {renderCard(proposal, CARD_OPTIONS)}
        </ProposalFeedItem>
      ))}
      {listFooter && <li>{listFooter}</li>}
    </ProposalFeed>
  );
}
