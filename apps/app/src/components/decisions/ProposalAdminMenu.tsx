'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuEye, LuEyeOff, LuMerge, LuTrash2 } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { MergeProposalDialog } from './MergeProposalDialog';
import { DeleteProposalDialog } from './ProposalCard/DeleteProposalDialog';
import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from './ProposalOptionsMenu';
import { getProposalDisplayTitle } from './mergeCandidates';
import { useProposalModerationActions } from './useProposalModerationActions';

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
  const t = useTranslations();
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const { toggleVisibility, isHidden, isLoading } =
    useProposalModerationActions(proposal);
  // Nothing is invalidated here: the mutation registers the affected proposal
  // channels server-side, so the lists and the proposal page refresh themselves.
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

  // Figma puts the merge record in the header as a plain link, so the way back
  // lives here: a superseded proposal is filtered out of every listing, and its
  // own page is the only surface that can offer the undo. Gated on the flag
  // too, since the item it feeds is.
  const { data: mergedAway } = trpc.decision.listProposalRelationships.useQuery(
    { sourceProposalId: proposal.id },
    { enabled: mergeEnabled && proposal.access?.admin === true },
  );
  const supersededBy = mergedAway?.relationships[0];

  const canModerate =
    proposal.access?.admin === true && proposal.status !== ProposalStatus.DRAFT;

  if (!canModerate) {
    return null;
  }

  const triggerLabel = t('Proposal options');

  // Merge leads, matching the card kebab's Figma order (15311:9078). Once
  // merged, the same slot offers the undo — the server rejects merging a
  // proposal that already has an outgoing edge, so the two never apply at once.
  const mergeItem: ProposalOptionsMenuItem | null = !mergeEnabled
    ? null
    : supersededBy
      ? {
          key: 'unmerge',
          icon: <LuMerge className="size-5" />,
          label: t('Unmerge'),
          onAction: () =>
            unmergeMutation.mutate(
              { sourceProposalId: proposal.id },
              {
                // Per-call rather than on the mutation, so the toast can name
                // the proposal: the input carries an id, not a title.
                onSuccess: () =>
                  toast.success(
                    t('{source} is listed on its own again.', {
                      source: getProposalDisplayTitle(
                        proposal,
                        t('Untitled Proposal'),
                      ),
                    }),
                  ),
              },
            ),
          isDisabled: unmergeMutation.isPending,
        }
      : {
          key: 'merge',
          icon: <LuMerge className="size-5" />,
          label: t('Merge with another proposal'),
          onAction: () => setIsMergeModalOpen(true),
          isDisabled: isLoading,
        };

  const items: ProposalOptionsMenuItem[] = [
    ...(mergeItem ? [mergeItem] : []),
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
      {!mergeEnabled || supersededBy ? null : (
        <MergeProposalDialog
          proposal={proposal}
          open={isMergeModalOpen}
          onOpenChange={setIsMergeModalOpen}
        />
      )}
    </ProposalOptionsMenu>
  );
}
