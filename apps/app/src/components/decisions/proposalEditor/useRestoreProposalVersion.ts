'use client';

import { trpc } from '@op/api/client';
import {
  PROPOSAL_TITLE_MAX_LENGTH,
  normalizeProposalCategories,
  parseProposalData,
} from '@op/common/client';
import type { ProposalData } from '@op/common/client';
import { toast } from '@op/sense/Toast';
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
  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: () => {
      toast.success(t('Proposal version restored'));
    },
    onError: (error) => {
      toast.error(t('Failed to restore proposal version'), {
        description: error.message || t('An unexpected error occurred'),
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
    // Clamped to what the API accepts: versions predate the cap, and the
    // document is reverted before this is persisted, so a title the schema
    // rejects would leave the body restored and the metadata not.
    const nextTitle = getFragmentText(fragmentContents.title).slice(
      0,
      PROPOSAL_TITLE_MAX_LENGTH,
    );
    const nextCategory = normalizeProposalCategories(
      getFragmentText(fragmentContents.category),
    );
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
   * Restores the proposal to the specified version using the provided fragment
   * contents: reverts the collaborative document and persists the extracted
   * field values.
   *
   * Returns false without touching anything when the version's contents aren't
   * available — the preview arrives asynchronously, and reverting on an empty
   * map would blank the title, category and budget.
   */
  async function restoreVersion(
    versionId: number,
    fragmentContents: Record<string, JSONContent | null>,
  ): Promise<boolean> {
    if (Object.keys(fragmentContents).length === 0) {
      toast.error(t('That version is still loading'), {
        description: t('Wait for the preview to appear, then try again.'),
      });
      return false;
    }

    const restoredData = buildRestoredProposalData(fragmentContents);

    provider.revertToVersion(versionId, {
      fields: fragmentNames,
      // TipTap snapshots twice by default: the content before the revert, and
      // the reverted content. The second one duplicates the list's synthetic
      // "Current version" row — it *is* the current document — so suppress it.
      // The pre-revert snapshot stays: it's the only copy of what the restore
      // replaced, and the auto-versioner will capture the restored state on the
      // next edit anyway.
      newVersionName: false,
    });

    await updateProposalMutation.mutateAsync({
      proposalId,
      data: restoredData,
    });

    return true;
  }

  return {
    restoreVersion,
  };
}
