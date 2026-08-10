'use client';

import type { Proposal } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';

import { ProposalCardMenu, ProposalCardView } from './ProposalCard';

interface ProposalMapListItemProps {
  proposal: Proposal;
  /** Proposal detail link — the whole card navigates here. */
  href: string;
  /** Highlighted because its marker (or this row) is hovered/active. */
  isActive: boolean;
  /**
   * When true the admin proposal menu (triple dots) renders in the header,
   * matching the grid view's `showMenu = canManageProposals` logic.
   */
  canManage?: boolean;
  /** Called when the pointer enters the row (desktop hover sync). */
  onActivate: () => void;
  /** Called when the pointer leaves the row. */
  onDeactivate: () => void;
}

/**
 * A compact proposal card for the map browse view's list column. The card's
 * stretched title link navigates to the proposal (the whole card is clickable),
 * while the admin menu stays independently clickable above it. Hovering syncs
 * the active state with the matching map marker.
 */
export function ProposalMapListItem({
  proposal,
  href,
  isActive,
  canManage = false,
  onActivate,
  onDeactivate,
}: ProposalMapListItemProps) {
  return (
    <li onMouseEnter={onActivate} onMouseLeave={onDeactivate}>
      <ProposalCardView
        proposal={proposal}
        href={href}
        showMetrics
        className={cn(
          'min-w-0 transition-colors',
          isActive ? 'border-input bg-muted' : 'hover:bg-muted',
        )}
        aside={
          canManage ? (
            // The title's stretched link covers the card; swallow the menu's
            // pointer events so opening it doesn't also navigate.
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ProposalCardMenu proposal={proposal} canManage={canManage} />
            </div>
          ) : undefined
        }
      />
    </li>
  );
}
