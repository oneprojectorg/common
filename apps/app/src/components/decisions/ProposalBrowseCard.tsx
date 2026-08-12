'use client';

import { canEngageWithProposals } from '@/hooks/useProposalEngagement';
import { type DecisionAccess, ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';

import {
  ProposalCardMenu,
  ProposalCardOwnerActions,
  ProposalCardReviseAction,
  ProposalCardView,
} from './ProposalCard';
import { proposalEditHref, proposalHref } from './proposalHrefs';

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
  const canEngage = canEngageWithProposals(permissions);

  const isDraft = proposal.status === ProposalStatus.DRAFT;
  const isEditable = Boolean(proposal.isEditable);
  const showMenu = canManageProposals || isEditable;
  const hasRevisionRequest = revisionRequestId !== undefined;

  const route = {
    profileId: proposal.profileId,
    decisionSlug,
    slug,
    instanceId,
  };
  const editHref = proposalEditHref(route);
  const reviseHref = revisionRequestId
    ? `${editHref}?reviewRevision=${revisionRequestId}`
    : editHref;
  const viewHref = proposalHref(route);

  // Only pass `actions` when something will actually render — otherwise the
  // card draws a separator + empty row. Like/Follow aren't here: they are the
  // metric toggles, driven by `canEngage`.
  //
  // Edit/Delete are buttons only on a draft, where finishing the proposal is
  // the card's purpose. Everywhere else they'd sit on every card an admin can
  // touch — which is all of them — so they live in the `…` menu.
  const actions = hasRevisionRequest ? (
    <ProposalCardReviseAction editHref={reviseHref} />
  ) : isDraft ? (
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
            editHref={isDraft ? undefined : editHref}
            canManage={canManageProposals}
          />
        ) : undefined
      }
      actions={actions}
      showMetrics={!isDraft}
      // Engagement replaced the old Like/Follow footer, and that footer shared
      // one slot with the owner and revision actions — so nobody saw
      // Like/Follow on a proposal they could edit. Spelled out rather than
      // derived from `actions`, which no longer tracks it now that Edit and
      // Delete have moved into the menu.
      canEngage={canEngage && !isDraft && !isEditable && !hasRevisionRequest}
      revisionRequested={hasRevisionRequest}
      className={cn(isDraft && 'bg-muted', className)}
    />
  );
}
