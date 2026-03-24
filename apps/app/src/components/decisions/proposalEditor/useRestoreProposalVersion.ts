'use client';

import { trpc } from '@op/api/client';
import { parseProposalData } from '@op/common/client';
import type { ProposalData } from '@op/common/client';
import { toast } from '@op/ui/Toast';
import type { JSONContent } from '@tiptap/react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from '../../collaboration';
import { getFragmentText, parsePreviewBudget } from './proposalPreviewContent';

interface UseRestoreProposalVersionOptions {
  proposalId: string;
  proposalData: unknown;
  fragmentNames: string[];
}

/**
 * Encapsulates the logic for restoring a proposal to a previous version.
 *
 * Handles extracting field values from the provided fragment contents,
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

  /**
   * Restores the proposal to the specified version using the provided
   * fragment contents. Reverts the collaborative document and persists
   * the extracted field values.
   */
  async function restoreVersion(
    versionId: number,
    fragmentContents: Record<string, JSONContent | null>,
  ): Promise<void> {
    const restoredData = buildRestoredProposalData(fragmentContents);

    provider.revertToVersion(versionId, fragmentNames);

    await updateProposalMutation.mutateAsync({
      proposalId,
      data: restoredData,
    });
  }

  return {
    restoreVersion,
  };
}
