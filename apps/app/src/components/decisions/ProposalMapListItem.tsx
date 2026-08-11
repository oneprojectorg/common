'use client';

import { type DecisionAccess } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';

import { ProposalBrowseCard } from './ProposalBrowseCard';

interface ProposalMapListItemProps {
  proposal: Proposal;
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links. */
  decisionSlug?: string;
  permissions?: DecisionAccess | null;
  /** Id of this proposal's open revision request, if it has one. */
  revisionRequestId?: string;
  /** Highlighted because its marker or this row is hovered. */
  isActive: boolean;
  /** The highlight came from the map, so the row tints rather than just outlining. */
  isPinHovered?: boolean;
  /** Called when the pointer enters the row (desktop hover sync). */
  onActivate: () => void;
  /** Called when the pointer leaves the row. */
  onDeactivate: () => void;
}

/**
 * One row of the map browse view's list column: the same card the grid
 * renders, plus the hover highlight that syncs with the matching map marker.
 */
export function ProposalMapListItem({
  isActive,
  isPinHovered = false,
  onActivate,
  onDeactivate,
  ...card
}: ProposalMapListItemProps) {
  return (
    <li onMouseEnter={onActivate} onMouseLeave={onDeactivate}>
      <ProposalBrowseCard
        {...card}
        className={cn(
          // `min-w-0` so a long title can't widen the list column.
          'min-w-0 transition-colors',
          isActive && 'border-input',
          isPinHovered && 'bg-muted',
        )}
      />
    </li>
  );
}
