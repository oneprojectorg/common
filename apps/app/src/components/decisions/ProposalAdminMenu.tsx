'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

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
 * Admin overflow menu (`…`) for the proposal page's action row: hide / unhide
 * and delete.
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
      toast.error(
        error.message ||
          t('Could not unmerge this proposal. Please try again.'),
      );
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
  const supersededBy = mergedAway?.relationships[0];

  const triggerLabel = t('Proposal options');
  const showMergeDialog = mergeEnabled && !supersededBy;

  const handleUnmerge = () =>
    unmergeMutation.mutate(
      { sourceProposalId: proposal.id },
      {
        // Per-call so the toast can name it; the input carries only an id.
        onSuccess: () =>
          toast.success(
            t('{source} is listed on its own again.', {
              source: getProposalDisplayTitle(proposal, t('Untitled Proposal')),
            }),
          ),
      },
    );

  // Merge leads, matching the card kebab (Figma 15311:9078).
  const mergeItem = mergeEnabled
    ? buildMergeMenuItem({
        isDisabled: isLoading || unmergeMutation.isPending,
        mergeLabel: t('Merge with another proposal'),
        onMerge: () => setIsMergeModalOpen(true),
        unmerge: {
          isSuperseded: Boolean(supersededBy),
          label: t('Unmerge'),
          onAction: handleUnmerge,
        },
      })
    : null;

  const rejectItem = rejectEnabled
    ? buildRejectMenuItem({
        isDisabled:
          isLoading ||
          unmergeMutation.isPending ||
          isRejecting ||
          isUnrejecting,
        isRejected,
        rejectLabel: t('Do not advance'),
        undoLabel: t('Undo rejection'),
        onReject: () => setIsRejectModalOpen(true),
        onUndo: unreject,
      })
    : null;

  const items: ProposalOptionsMenuItem[] = [
    ...(mergeItem ? [mergeItem] : []),
    ...(rejectItem ? [rejectItem] : []),
    {
      key: 'visibility',
      icon: isHidden ? (
        <LuEye className="size-5" />
      ) : (
        <LuEyeOff className="size-5" />
      ),
      label: isHidden ? t('Unhide proposal') : t('Hide proposal'),
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
