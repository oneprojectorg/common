'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { templateCollectsBudget } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { toast } from '@op/sense/Toast';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLeaf, LuTriangleAlert } from 'react-icons/lu';

import { usePathname, useRouter, useTranslations } from '@/lib/i18n';

import { FinalPhaseSelectionFooter } from './FinalPhaseSelectionFooter';
import { QUERY_PARAM as RESULTS_LIVE_PARAM } from './FinalPhaseSubmissionSuccessDialog';
import {
  ManualSelectionToolbar,
  type SelectionFilters,
} from './ManualSelectionToolbar';
import { SelectableProposalsTable } from './SelectableProposalsTable';
import { StandardSelectionFooter } from './StandardSelectionFooter';
import { useManualSelection } from './useManualSelection';

interface ManualSelectionListProps {
  instanceId: string;
  decisionSlug: string;
  /**
   * `'finalPhase'` switches the confirm modal to the funded-results layout
   * (see Figma 2310-10152) and adds a vote column to the table. Defaults to
   * the standard advance-to-next-phase layout used for mid-process selection.
   */
  confirmVariant?: 'standard' | 'finalPhase';
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

export const ManualSelectionList = ({
  instanceId,
  decisionSlug,
  confirmVariant = 'standard',
  pinOffset,
}: ManualSelectionListProps) => {
  const t = useTranslations();
  const posthog = usePostHog();
  const router = useRouter();
  const pathname = usePathname();
  const isFinalPhase = confirmVariant === 'finalPhase';

  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [sortOrder, setSortOrder] =
    useState<SelectionFilters['sortOrder']>('votes');

  const categoryId =
    selectedCategory === 'all-categories' ? undefined : selectedCategory;

  const [[categoriesData, instance]] = trpc.useSuspenseQueries((q) => [
    q.decision.getCategories({ processInstanceId: instanceId }),
    q.decision.getInstance({ instanceId }),
  ]);

  // The selection list is only mounted once a phase exists; throw if it
  // doesn't so localStorage doesn't bucket unrelated sessions under ''.
  if (!instance.currentStateId) {
    throw new Error('ManualSelectionList: instance has no currentStateId');
  }

  // Non-suspense + placeholderData so category/sort changes don't blank
  // the table while the server re-fetches.
  const candidatesQuery = trpc.decision.listSelectionCandidates.useQuery(
    { processInstanceId: instanceId, categoryId, sortOrder },
    { placeholderData: (prev) => prev },
  );
  const candidates = candidatesQuery.data;

  const [selectedIds, setSelectedIds] = useManualSelection(
    instanceId,
    instance.currentStateId,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Resolve selected ids → proposals via a cache that accumulates across
  // refetches, so picks survive filter/sort changes that exclude them.
  const [proposalCache, setProposalCache] = useState<Record<string, Proposal>>(
    {},
  );
  useEffect(() => {
    if (!candidates) return;
    setProposalCache((prev) => {
      const next = { ...prev };
      for (const p of candidates.proposals) next[p.id] = p;
      return next;
    });
  }, [candidates]);

  const selectedProposals = useMemo(
    () =>
      selectedIds
        .map((id) => proposalCache[id])
        .filter((p): p is Proposal => Boolean(p)),
    [selectedIds, proposalCache],
  );

  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: () => {
      // Channel-based invalidation flips selectionsAreConfirmed in the client
      // tRPC cache, which both the (client) DecisionHeader and DecisionStateRouter
      // observe via useSuspenseQuery — DecisionStateRouter then swaps to
      // ResultsPage. Add the resultsLive flag to the URL so the dialog mounted
      // on ResultsPage opens on this admin's machine only.
      setSelectedIds([]);
      setIsConfirmOpen(false);
      if (isFinalPhase) {
        const params = new URLSearchParams(window.location.search);
        params.set(RESULTS_LIVE_PARAM, '1');
        router.replace(`${pathname}?${params.toString()}`);
      }
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      toast.error(error.message);
    },
  });

  const handleConfirmDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        posthog.capture('manual_selection_dialog_opened', {
          process_instance_id: instanceId,
          proposal_count: selectedIds.length,
        });
      } else if (submitMutation.status === 'idle') {
        // Only treat a close as a user-initiated dismiss when no submission
        // has run. Pending → in-flight close, success → already-submitted.
        posthog.capture('manual_selection_dialog_dismissed', {
          process_instance_id: instanceId,
          proposal_count: selectedIds.length,
        });
      }
      setIsConfirmOpen(open);
    },
    [instanceId, selectedIds.length, submitMutation.status, posthog],
  );

  const toolbarFilters = useMemo<SelectionFilters>(
    () => ({ selectedCategory, sortOrder }),
    [selectedCategory, sortOrder],
  );

  const handleToolbarChange = useCallback(
    (patch: Partial<SelectionFilters>) => {
      if (patch.selectedCategory !== undefined) {
        setSelectedCategory(patch.selectedCategory);
      }
      if (patch.sortOrder !== undefined) {
        setSortOrder(patch.sortOrder);
      }
    },
    [],
  );

  const handleConfirmSelection = useCallback(() => {
    posthog.capture('manual_selection_dialog_confirmed', {
      process_instance_id: instanceId,
      proposal_count: selectedIds.length,
    });
    submitMutation.mutate({
      processInstanceId: instanceId,
      proposalIds: selectedIds,
    });
  }, [instanceId, selectedIds, submitMutation, posthog]);

  if (candidatesQuery.isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuTriangleAlert className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('Failed to load proposals')}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => candidatesQuery.refetch()}
          >
            {t('Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (!candidates) {
    return null;
  }

  // Full pool empty → dead end, no toolbar. A narrowing category filter keeps
  // the toolbar (below) so the admin can loosen it.
  if (!categoryId && candidates.proposals.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLeaf className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('No proposals available to select')}</EmptyTitle>
          <EmptyDescription>
            {t('The previous phase did not leave any eligible proposals.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const toggleProposal = (proposalId: string) => {
    setSelectedIds(
      selectedIds.includes(proposalId)
        ? selectedIds.filter((id) => id !== proposalId)
        : [...selectedIds, proposalId],
    );
  };

  const proposals = candidates.proposals;
  const numSelected = selectedIds.length;
  // No budget key in the instance's proposal template means the process
  // collects no budgets, so the column would only ever show "—".
  const showBudget = templateCollectsBudget(
    instance.instanceData?.proposalTemplate,
  );
  const currentPhaseName =
    instance.instanceData?.phases?.find(
      (p) => p.phaseId === instance.currentStateId,
    )?.name ?? '';

  return (
    <div className="relative flex flex-col gap-6 pb-20">
      <ManualSelectionToolbar
        count={proposals.length}
        categories={categoriesData.categories}
        filters={toolbarFilters}
        onChange={handleToolbarChange}
        pinOffset={pinOffset}
      />

      {proposals.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuLeaf className="size-6" />
            </EmptyMedia>
            <EmptyTitle>
              {t('No proposals match the current filter')}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <SelectableProposalsTable
          proposals={proposals}
          selectedIds={selectedIds}
          onToggle={toggleProposal}
          getProposalHref={(p) =>
            `/decisions/${decisionSlug}/proposal/${p.profileId}`
          }
          showVotes={isFinalPhase}
          showBudget={showBudget}
        />
      )}

      {isFinalPhase ? (
        <FinalPhaseSelectionFooter
          selectedProposals={selectedProposals}
          numSelected={numSelected}
          isConfirmOpen={isConfirmOpen}
          onConfirmOpenChange={handleConfirmDialogOpenChange}
          onConfirm={handleConfirmSelection}
          isSubmitting={submitMutation.isPending}
        />
      ) : (
        <StandardSelectionFooter
          selectedProposals={selectedProposals}
          numSelected={numSelected}
          phaseName={currentPhaseName}
          isConfirmOpen={isConfirmOpen}
          onConfirmOpenChange={handleConfirmDialogOpenChange}
          onConfirm={handleConfirmSelection}
          isSubmitting={submitMutation.isPending}
        />
      )}
    </div>
  );
};
