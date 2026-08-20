'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

/** Reads as "source merges into target": the source is superseded, the target survives. */
export interface MergeTarget {
  sourceProposalId: string;
  sourceTitle: string;
  targetProposalId: string;
  targetTitle: string;
  /**
   * The admin's stated reason, stored on the edge. Blank is normalized away by
   * the input schema, so passing the raw textarea value is safe.
   */
  note?: string;
}

export interface ProposalMergeActions {
  /** Rejects on failure (after toasting it), so the caller can keep its dialog open. */
  merge: (target: MergeTarget) => Promise<void>;
  unmerge: (source: {
    sourceProposalId: string;
    sourceTitle: string;
  }) => Promise<void>;
  isMerging: boolean;
  isUnmerging: boolean;
}

/**
 * Admin merge / unmerge for a pair of proposals, with the toast copy shared by
 * every surface that offers them (the browse-card kebab, the proposal-page
 * overflow menu, and the merge notice on the proposal page).
 *
 * Not bound to one proposal: unmerge acts on whichever proposal was superseded,
 * which is never the proposal whose page or card you are looking at.
 *
 * Nothing is invalidated here — both mutations register the affected proposal
 * channels server-side, so the lists and the proposal page refresh themselves.
 */
export function useProposalMergeActions(): ProposalMergeActions {
  const t = useTranslations();

  const mergeMutation = trpc.decision.mergeProposals.useMutation({
    onError: (error) => {
      toast.error(
        error.message || t('Could not merge this proposal. Please try again.'),
      );
    },
  });

  const unmergeMutation = trpc.decision.unmergeProposal.useMutation({
    onError: (error) => {
      toast.error(
        error.message ||
          t('Could not unmerge this proposal. Please try again.'),
      );
    },
  });

  return {
    merge: ({
      sourceProposalId,
      sourceTitle,
      targetProposalId,
      targetTitle,
      note,
    }: MergeTarget) =>
      mergeMutation.mutateAsync(
        { sourceProposalId, targetProposalId, note },
        {
          // Per-call rather than on the mutation, so the toast can name both
          // ends: the mutation's own input carries ids, not titles.
          onSuccess: () =>
            toast.success(
              t('{source} has now been merged with {target}', {
                source: sourceTitle,
                target: targetTitle,
              }),
            ),
        },
      ),
    unmerge: ({ sourceProposalId, sourceTitle }) =>
      unmergeMutation.mutateAsync(
        { sourceProposalId },
        {
          onSuccess: () =>
            toast.success(
              t('{source} is listed on its own again.', {
                source: sourceTitle,
              }),
            ),
        },
      ),
    isMerging: mergeMutation.isPending,
    isUnmerging: unmergeMutation.isPending,
  };
}
