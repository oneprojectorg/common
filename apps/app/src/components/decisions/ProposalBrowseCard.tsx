'use client';

import { canEngageWithProposals } from '@/hooks/useProposalEngagement';
import { type DecisionAccess, ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

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
  /** Status-row slot — the review-progress count on the review surface. */
  reviewedLabel?: ReactNode;
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
  reviewedLabel,
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
      // Access is the only gate, same as the proposal page. It used to also
      // exclude editable and revision-requested proposals, back when
      // Like/Follow shared the footer slot with the owner and revise actions —
      // but `isEditable` is true of every proposal for an admin, so that took
      // engagement away from the people who most often browse. Drafts are
      // excluded because they carry no metrics at all.
      canEngage={canEngage && !isDraft}
      revisionRequested={hasRevisionRequest}
      reviewedLabel={reviewedLabel}
      className={cn(isDraft && 'bg-muted', className)}
    />
  );
}
