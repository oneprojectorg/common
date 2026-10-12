'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuArrowRight, LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { MergeProposalDialog } from './MergeProposalDialog';
import { DeleteProposalDialog } from './ProposalCard/DeleteProposalDialog';
import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from './ProposalOptionsMenu';
import { RejectProposalDialog } from './RejectProposalDialog';
import { buildMergeMenuItem, getProposalDisplayTitle } from './proposals/merge';
import { buildRejectMenuItem } from './proposals/reject';
import { useProposalModerationActions } from './useProposalModerationActions';
import { useProposalRejectionActions } from './useProposalRejectionActions';

/**
 * Admin overflow menu (`…`) for the proposal page's action row: hide / unhide,
 * delete, and "Advance to [phase]" for a proposal outside the current phase.
 * Mirrors the browse-card kebab (`ProposalCard/ProposalCardMenu`) and shares its
 * mutation + toast copy via {@link useProposalModerationActions}, so the two
 * surfaces can't drift.
 *
 * The Figma frame also shows shortlist / reject-from-shortlist here, but #1630
 * removed those actions from the app, so they aren't offered on either surface.
 *
 * Renders nothing unless the viewer has decision-admin access and the proposal
 * has left draft.
 */
export function ProposalAdminMenu({
  proposal,
  backHref,
}: {
  proposal: Proposal;
  /** Where to go after deleting — this page is about to 404. */
  backHref: string;
}) {
  const canModerate =
    proposal.access?.admin === true && proposal.status !== ProposalStatus.DRAFT;

  if (!canModerate) {
    return null;
  }

  return <ProposalAdminMenuItems proposal={proposal} backHref={backHref} />;
}

/** Split from the gate so the hooks only run for a viewer who can act. */
function ProposalAdminMenuItems({
  proposal,
  backHref,
}: {
  proposal: Proposal;
  backHref: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const { toggleVisibility, isHidden, isLoading } =
    useProposalModerationActions(proposal);
  // No invalidation needed: the endpoint registers the affected proposal channels.
  const unmergeMutation = trpc.decision.unmergeProposal.useMutation({
    onError: (error) => {
      toast.error(error.message || t('decisions.proposals.unmergeError'));
      logger.error('Failed to unmerge proposal', {
        error,
        context: 'ProposalAdminMenu',
      });
    },
  });
  const mergeEnabled = useFeatureFlag('merge-proposals') ?? false;
  const rejectEnabled = useFeatureFlag('reject-proposals') ?? false;
  // The parent gate already requires admin + non-draft, so the slot always
  // shows; it just toggles to Undo once rejected.
  const isRejected = proposal.status === ProposalStatus.REJECTED;
  const { reject, unreject, isRejecting, isUnrejecting } =
    useProposalRejectionActions(proposal);

  // A superseded proposal leaves every listing, so its own page is the only
  // surface that can offer the undo. Gated with the item it feeds.
  const { data: mergedAway } = trpc.decision.listProposalRelationships.useQuery(
    { sourceProposalId: proposal.id },
    { enabled: mergeEnabled },
  );
  const supersededBy = mergedAway?.items[0];

  const triggerLabel = t('decisions.proposals.proposalOptionsLabel');
  const showMergeDialog = mergeEnabled && !supersededBy;

  const handleUnmerge = () =>
    unmergeMutation.mutate(
      { sourceProposalId: proposal.id },
      {
        // Per-call so the toast can name it; the input carries only an id.
        onSuccess: () =>
          toast.success(
            t('decisions.proposals.unmergeSuccess', {
              source: getProposalDisplayTitle(
                proposal,
                t('decisions.proposals.untitledProposal'),
              ),
            }),
          ),
      },
    );

  const { advanceTarget, advance, isAdvancing } = useProposalAdvance({
    proposal,
    isRejected,
  });
  // Advancing, rejecting and unmerging all move the proposal between pools,
  // so none starts while another is in flight.
  const isBusy =
    isLoading ||
    unmergeMutation.isPending ||
    isRejecting ||
    isUnrejecting ||
    isAdvancing;

  // Merge leads, matching the card kebab (Figma 15311:9078).
  const mergeItem = mergeEnabled
    ? buildMergeMenuItem({
        isDisabled: isBusy,
        mergeLabel: t('decisions.proposals.mergeProposalAction'),
        onMerge: () => setIsMergeModalOpen(true),
        unmerge: {
          isSuperseded: Boolean(supersededBy),
          label: t('decisions.proposals.unmergeAction'),
          onAction: handleUnmerge,
        },
      })
    : null;

  const rejectItem = rejectEnabled
    ? buildRejectMenuItem({
        isDisabled: isBusy,
        isRejected,
        rejectLabel: t('decisions.proposals.doNotAdvanceAction'),
        undoLabel: t('decisions.proposals.undoRejectionAction'),
        onReject: () => setIsRejectModalOpen(true),
        onUndo: unreject,
      })
    : null;

  const items: ProposalOptionsMenuItem[] = [
    ...(mergeItem ? [mergeItem] : []),
    ...(rejectItem ? [rejectItem] : []),
    ...(advanceTarget
      ? [
          {
            key: 'advance',
            icon: <LuArrowRight className="size-5 rtl:-scale-x-100" />,
            label: t('decisions.proposals.advanceToPhaseAction', {
              phase: advanceTarget.phaseName,
            }),
            onAction: advance,
            isDisabled: isBusy,
          },
        ]
      : []),
    {
      key: 'visibility',
      icon: isHidden ? (
        <LuEye className="size-5" />
      ) : (
        <LuEyeOff className="size-5" />
      ),
      label: isHidden
        ? t('decisions.proposals.unhideProposalAction')
        : t('decisions.proposals.hideProposalAction'),
      onAction: toggleVisibility,
      isDisabled: isLoading,
    },
    {
      key: 'delete',
      icon: <LuTrash2 className="size-5" />,
      label: t('Delete'),
      onAction: () => setIsDeleteModalOpen(true),
      isDisabled: isLoading,
      isDestructive: true,
    },
  ];

  return (
    <ProposalOptionsMenu
      groups={[items]}
      label={triggerLabel}
      triggerProps={{ variant: 'outline', size: 'icon' }}
    >
      <DeleteProposalDialog
        proposalId={proposal.id}
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        onDeleted={() => router.push(backHref)}
      />
      {showMergeDialog ? (
        <MergeProposalDialog
          proposal={proposal}
          open={isMergeModalOpen}
          onOpenChange={setIsMergeModalOpen}
        />
      ) : null}
      {rejectEnabled && !isRejected ? (
        <RejectProposalDialog
          open={isRejectModalOpen}
          onOpenChange={setIsRejectModalOpen}
          isPending={isRejecting}
          onConfirm={(input) =>
            reject(input, { onSuccess: () => setIsRejectModalOpen(false) })
          }
        />
      ) : null}
    </ProposalOptionsMenu>
  );
}

/**
 * The phase this proposal can be advanced into (`undefined` while loading or
 * when it can't move), and the action that advances it. No invalidation
 * needed: the endpoints register the proposal channels.
 */
function useProposalAdvance({
  proposal,
  isRejected,
}: {
  proposal: Proposal;
  /** A rejected proposal can never advance, so it isn't asked about. */
  isRejected: boolean;
}) {
  const t = useTranslations();
  const { data } = trpc.decision.getProposalAdvanceTarget.useQuery(
    { proposalId: proposal.id },
    { enabled: !isRejected },
  );
  // A disabled query keeps its last data, so rejecting would leave it stale.
  const advanceTarget = isRejected ? undefined : data;
  const advanceMutation = trpc.decision.advanceProposal.useMutation({
    onError: (error) => {
      toast.error(t('decisions.proposals.advanceError'));
      logger.error('Failed to advance proposal', {
        error,
        context: 'ProposalAdminMenu',
      });
    },
  });

  const advance = () => {
    if (advanceTarget) {
      const { phaseId, phaseName } = advanceTarget;
      advanceMutation.mutate(
        { proposalId: proposal.id, phaseId },
        {
          // Per-call so the toast can name the phase it was offered.
          onSuccess: () =>
            toast.success(
              t('decisions.proposals.advanceSuccess', { phase: phaseName }),
            ),
        },
      );
    }
  };

  return {
    advanceTarget,
    advance,
    isAdvancing: advanceMutation.isPending,
  };
}
