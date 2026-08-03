'use client';

import type { Proposal } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';

import { Link } from '@/lib/i18n/routing';

import {
  ProposalCard,
  ProposalCardContent,
  ProposalCardHeader,
  ProposalCardMenu,
  ProposalCardMeta,
  ProposalCardMetrics,
  ProposalCardPreview,
} from './ProposalCard';

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
 * A compact, single-column proposal card for the map browse view's list column.
 * The whole row is one link to the proposal — every inner piece is rendered
 * non-link (`withLink={false}`, no `viewHref`) so there are no nested anchors.
 * Hovering syncs the active state with the matching map marker.
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
      <Link
        href={href}
        // The whole card is one link; keep it from imposing anchor link styling
        // (underline / link color) on the card content.
        className="block rounded text-neutral-black no-underline outline-0 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tealBlack"
      >
        <ProposalCard
          proposal={proposal}
          className={cn(
            'min-w-0 transition-colors',
            isActive
              ? 'border-neutral-gray2 bg-neutral-offWhite'
              : 'hover:bg-neutral-offWhite',
          )}
        >
          <ProposalCardContent>
            <ProposalCardHeader
              proposal={proposal}
              menu={
                canManage && (
                  // The whole row is a link; swallow the menu's click events so
                  // pressing the trigger doesn't also navigate to the proposal.
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ProposalCardMenu
                      proposal={proposal}
                      canManage={canManage}
                    />
                  </div>
                )
              }
            />
            <ProposalCardMeta proposal={proposal} withLink={false} />
            <ProposalCardPreview proposal={proposal} />
          </ProposalCardContent>
          <ProposalCardMetrics proposal={proposal} />
        </ProposalCard>
      </Link>
    </li>
  );
}
