'use client';

import { trpc } from '@op/api/client';
import { parseProposalData } from '@op/common/client';
import type { ProposalData } from '@op/common/client';
import { toast } from '@op/ui/Toast';
import type { JSONContent } from '@tiptap/react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../collaboration';
import { useOptionalVersionPreview } from './VersionPreviewContext';
import { getFragmentText, parsePreviewBudget } from './proposalPreviewContent';

interface UseRestoreProposalVersionOptions {
  proposalId: string;
  proposalData: unknown;
  fragmentNames: string[];
}

/**
 * Encapsulates the logic for restoring a proposal to a previous version.
 *
 * Handles extracting field values from the version preview fragments,
 * reverting the collaborative document, and persisting the restored
 * proposal data via mutation.
 */
export function useRestoreProposalVersion({
  proposalId,
  proposalData,
  fragmentNames,
}: UseRestoreProposalVersionOptions) {
  const t = useTranslations();
  const { provider } = useCollaborativeDoc();
  const utils = trpc.useUtils();
  const versionPreview = useOptionalVersionPreview();

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: () => {
      toast.success({
        message: t('Proposal version restored'),
      });
      utils.decision.getProposal.invalidate();
      utils.decision.listProposals.invalidate();
    },
    onError: (error) => {
      toast.error({
        title: t('Failed to restore proposal version'),
        message: error.message || t('An unexpected error occurred'),
      });
    },
  });

  /**
   * Extracts field values from version preview fragment contents and merges
   * them with the current proposal data.
   */
  function buildRestoredProposalData(
    fragmentContents: Record<string, JSONContent | null>,
  ): { title: string; proposalData: ProposalData } {
    const currentProposalData = parseProposalData(proposalData);
    const nextTitle = getFragmentText(fragmentContents.title);
    const nextCategory =
      getFragmentText(fragmentContents.category) || undefined;
    const nextBudget = parsePreviewBudget(fragmentContents.budget);

    return {
      title: nextTitle,
      proposalData: {
        ...currentProposalData,
        collaborationDocId: currentProposalData.collaborationDocId,
        category: nextCategory,
        budget: nextBudget,
      },
    };
  }

  /** Whether the version preview is loaded and ready for the current version. */
  const canRestore =
    versionPreview !== null &&
    versionPreview.tiptapVersion !== null &&
    Object.keys(versionPreview.fragmentContents).length > 0;

  /**
   * Restores the proposal to the currently previewed version.
   *
   * Reverts the collaborative document and persists the extracted field
   * values. No-ops if the version preview isn't ready.
   */
  async function restoreVersion(): Promise<void> {
    if (!versionPreview?.tiptapVersion || !canRestore) {
      return;
    }

    const restoredData = buildRestoredProposalData(
      versionPreview.fragmentContents,
    );

    provider.revertToVersion(versionPreview.tiptapVersion.version, fragmentNames);

    await updateProposalMutation.mutateAsync({
      proposalId,
      data: restoredData,
    });
  }

  return {
    restoreVersion,
    canRestore,
    isPending: updateProposalMutation.isPending,
  };
}
