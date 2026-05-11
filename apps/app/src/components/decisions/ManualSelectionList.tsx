'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { FooterBar } from '@op/ui/FooterBar';
import { Header3 } from '@op/ui/Header';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuLeaf, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ManualSelectionToolbar } from './ManualSelectionToolbar';
import { SelectableProposalsTable } from './SelectableProposalsTable';
import { SelectionConfirmDialog } from './SelectionConfirmDialog';
import { useManualSelection } from './useManualSelection';
import { useProposalFilters } from './useProposalFilters';

// Stable reference: useProposalFilters memoizes on `votedProposalIds`.
const EMPTY_VOTED_IDS: string[] = [];

interface ManualSelectionListProps {
  instanceId: string;
  decisionSlug: string;
  /** Override the default "Confirm decisions" footer button label. */
  confirmButtonLabel?: string;
  /**
   * `'finalPhase'` switches the confirm modal to the funded-results layout
   * (see Figma 2310-10152). Defaults to the standard advance-to-next-phase
   * layout used for mid-process manual selection.
   */
  confirmVariant?: 'standard' | 'finalPhase';
}

export const ManualSelectionList = ({
  instanceId,
  decisionSlug,
  confirmButtonLabel,
  confirmVariant = 'standard',
}: ManualSelectionListProps) => {
  const t = useTranslations();
  const { user } = useUser();
  const posthog = usePostHog();
  const router = useRouter();

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

  // Non-suspense + placeholderData so category/sort changes don't blank
  // the table while the server re-fetches.
  const candidatesQuery = trpc.decision.listSelectionCandidates.useQuery(
    { processInstanceId: instanceId, categoryId, sortOrder },
    { placeholderData: (prev) => prev },
  );
  const candidates = candidatesQuery.data;

  const [selectedIds, setSelectedIds] = useManualSelection(
    instanceId,
    instance.currentStateId ?? '',
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const submissionInitiatedRef = useRef(false);

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

  const categories = categoriesData.categories;
  const proposals = filteredProposals;

  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: () => {
      // Channel-based invalidation (Channels.decisionInstance) handles the
      // client query; router.refresh re-renders the SSR DecisionHeader so
      // its gradient/background picks up the new selectionsAreConfirmed.
      router.refresh();
      setSelectedIds([]);
      setIsConfirmOpen(false);
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      toast.error({ message: error.message });
    },
  });

  const handleConfirmDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        submissionInitiatedRef.current = false;
        posthog.capture('manual_selection_dialog_opened', {
          process_instance_id: instanceId,
          proposal_count: selectedIds.length,
        });
      } else if (!submitMutation.isPending && !submissionInitiatedRef.current) {
        posthog.capture('manual_selection_dialog_dismissed', {
          process_instance_id: instanceId,
          proposal_count: selectedIds.length,
        });
      }
      setIsConfirmOpen(open);
    },
    [instanceId, selectedIds.length, submitMutation.isPending, posthog],
  );

  const handleConfirmSelection = useCallback(() => {
    submissionInitiatedRef.current = true;
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
        categories={categories}
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
          showVotes={confirmVariant === 'finalPhase'}
        />
      )}

      <FooterBar position="fixed" className="bg-neutral-offWhite/95">
        <FooterBar.Start>
          <span className="text-base text-neutral-black">
            {t('{count} proposals advancing', { count: numSelected })}
          </span>
        </FooterBar.Start>
        <FooterBar.Center />
        <FooterBar.End>
          <SelectionConfirmDialog
            isOpen={isConfirmOpen}
            onOpenChange={handleConfirmDialogOpenChange}
            proposals={selectedProposals}
            count={numSelected}
            phaseName={currentPhaseName}
            triggerDisabled={numSelected === 0}
            isSubmitting={submitMutation.isPending}
            onConfirm={handleConfirmSelection}
            triggerLabel={confirmButtonLabel}
            variant={confirmVariant}
            totalBudget={
              confirmVariant === 'finalPhase'
                ? resolveInstanceBudget(instance.instanceData?.phases)
                : undefined
            }
          />
        </FooterBar.End>
      </FooterBar>
    </div>
  );
};

// Budget is stored under each phase's `settings.budget` (an opaque JSON record
// driven by the per-phase settings schema). Return the first numeric one found;
// `undefined` means we render the allocation block without a remaining figure.
const resolveInstanceBudget = (
  phases: ReadonlyArray<{ settings?: Record<string, unknown> }> | undefined,
): number | undefined => {
  if (!phases) {
    return undefined;
  }
  for (const phase of phases) {
    const value = phase.settings?.budget;
    if (typeof value === 'number' && value > 0) {
      return value;
    }
  }
  return undefined;
};
