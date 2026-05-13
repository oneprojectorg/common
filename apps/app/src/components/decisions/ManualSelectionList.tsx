'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLeaf, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FinalPhaseSelectionFooter } from './FinalPhaseSelectionFooter';
import { ManualSelectionToolbar } from './ManualSelectionToolbar';
import { SelectableProposalsTable } from './SelectableProposalsTable';
import { StandardSelectionFooter } from './StandardSelectionFooter';
import { useManualSelection } from './useManualSelection';
import { useProposalFilters } from './useProposalFilters';

// Stable reference: useProposalFilters memoizes on `votedProposalIds`.
const EMPTY_VOTED_IDS: string[] = [];

interface ManualSelectionListProps {
  instanceId: string;
  decisionSlug: string;
  /**
   * `'finalPhase'` switches the confirm modal to the funded-results layout
   * (see Figma 2310-10152) and adds a vote column to the table. Defaults to
   * the standard advance-to-next-phase layout used for mid-process selection.
   */
  confirmVariant?: 'standard' | 'finalPhase';
}

export const ManualSelectionList = ({
  instanceId,
  decisionSlug,
  confirmVariant = 'standard',
}: ManualSelectionListProps) => {
  const t = useTranslations();
  const { user } = useUser();
  const posthog = usePostHog();
  const router = useRouter();
  const isFinalPhase = confirmVariant === 'finalPhase';

  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [sortOrder, setSortOrder] = useState<'votes' | 'newest' | 'oldest'>(
    'votes',
  );

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

  const { filteredProposals, proposalFilter, setProposalFilter } =
    useProposalFilters({
      proposals: candidates?.proposals ?? [],
      currentProfileId: user.currentProfile?.id,
      votedProposalIds: EMPTY_VOTED_IDS,
      hasVoted: false,
      initialFilter: ProposalFilter.ALL,
    });

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
        params.set('resultsLive', '1');
        router.replace(`${window.location.pathname}?${params.toString()}`);
      }
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      toast.error({ message: error.message });
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
      <EmptyState icon={<LuTriangleAlert className="size-6" />}>
        <Header3 className="font-serif font-light">
          {t('Failed to load proposals')}
        </Header3>
        <Button
          onPress={() => candidatesQuery.refetch()}
          color="secondary"
          size="small"
        >
          {t('Try again')}
        </Button>
      </EmptyState>
    );
  }

  if (!candidates) {
    return null;
  }

  // Full pool empty → dead end, no toolbar. Any narrowing filter keeps
  // the toolbar (below) so the admin can loosen it.
  const isUnfiltered = !categoryId && proposalFilter === ProposalFilter.ALL;
  if (isUnfiltered && candidates.proposals.length === 0) {
    return (
      <EmptyState icon={<LuLeaf className="size-6" />}>
        <Header3 className="font-serif font-light">
          {t('No proposals available to select')}
        </Header3>
        <p className="text-base text-neutral-charcoal">
          {t('The previous phase did not leave any eligible proposals.')}
        </p>
      </EmptyState>
    );
  }

  const toggleProposal = (proposalId: string) => {
    setSelectedIds(
      selectedIds.includes(proposalId)
        ? selectedIds.filter((id) => id !== proposalId)
        : [...selectedIds, proposalId],
    );
  };

  const proposals = filteredProposals;
  const numSelected = selectedIds.length;
  const currentPhaseName =
    instance.instanceData?.phases?.find(
      (p) => p.phaseId === instance.currentStateId,
    )?.name ?? '';

  return (
    <div className="flex flex-col gap-6 pb-20">
      <ManualSelectionToolbar
        count={proposals.length}
        currentProfileId={user.currentProfile?.id}
        categories={categoriesData.categories}
        proposalFilter={proposalFilter}
        setProposalFilter={setProposalFilter}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {proposals.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif font-light">
            {t('No proposals match the current filter')}
          </Header3>
        </EmptyState>
      ) : (
        <SelectableProposalsTable
          proposals={proposals}
          selectedIds={selectedIds}
          onToggle={toggleProposal}
          getProposalHref={(p) =>
            `/decisions/${decisionSlug}/proposal/${p.profileId}`
          }
          showVotes={isFinalPhase}
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
