'use client';

import { type DecisionAccess, ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';

import {
  ProposalCardMenu,
  ProposalCardOwnerActions,
  ProposalCardReviseAction,
  ProposalCardView,
} from './ProposalCard';

interface ProposalBrowseCardProps {
  proposal: Proposal;
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links. */
  decisionSlug?: string;
  permissions?: DecisionAccess | null;
  /** Id of this proposal's open revision request, if it has one. */
  revisionRequestId?: string;
  className?: string;
}

/**
 * A proposal as it appears while browsing a decision — menu, owner actions,
 * engagement toggles, and the badges each phase adds.
 *
 * The grid and the map's list column both render this, so the two views can't
 * disagree about what a card shows in a given phase. Anything genuinely
 * view-specific (the map's hover highlight) comes in through `className`.
 */
export function ProposalBrowseCard({
  proposal,
  instanceId,
  slug,
  decisionSlug,
  permissions,
  revisionRequestId,
  className,
}: ProposalBrowseCardProps) {
  const canManageProposals = permissions?.admin ?? false;
  // Like/Follow require SUBMIT_PROPOSALS (or admin) on the parent decision —
  // don't offer buttons the API would reject (e.g. reviewer-only roles).
  const canEngage =
    (permissions?.submitProposals ?? false) || canManageProposals;

  const isDraft = proposal.status === ProposalStatus.DRAFT;
  const isEditable = Boolean(proposal.isEditable);
  const showMenu = canManageProposals || isEditable;
  const hasRevisionRequest = revisionRequestId !== undefined;

  // Use new route structure if decisionSlug is provided, otherwise fallback to legacy route
  const editHref = decisionSlug
    ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`
    : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}/edit`;
  const reviseHref = revisionRequestId
    ? `${editHref}?reviewRevision=${revisionRequestId}`
    : editHref;
  const viewHref = decisionSlug
    ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
    : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`;

  // Only pass `actions` when something will actually render — otherwise the
  // card draws a separator + empty row. Like/Follow aren't here: they are the
  // metric toggles, driven by `canEngage`.
  const actions = hasRevisionRequest ? (
    <ProposalCardReviseAction editHref={reviseHref} />
  ) : isDraft || isEditable ? (
    <ProposalCardOwnerActions proposal={proposal} editHref={editHref} />
  ) : undefined;

  return (
    <ProposalCardView
      proposal={proposal}
      href={viewHref}
      aside={
        showMenu ? (
          <ProposalCardMenu
            proposal={proposal}
            canManage={canManageProposals}
          />
        ) : undefined
      }
      actions={actions}
      showMetrics={!isDraft}
      // Engagement replaced the old Like/Follow footer, and that footer shared
      // one slot with the owner and revision actions — so an author never saw
      // Like/Follow on their own card. Keep that: the toggles light up only
      // where those buttons used to.
      canEngage={canEngage && !actions}
      revisionRequested={hasRevisionRequest}
      className={cn(isDraft && 'bg-muted', className)}
    />
  );
}
