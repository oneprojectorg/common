'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { useState } from 'react';
import { LuLeaf, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ManualSelectionToolbar } from './ManualSelectionToolbar';
import { SelectableProposalsTable } from './SelectableProposalsTable';
import { SelectionConfirmDialog } from './SelectionConfirmDialog';
import { SelectionSuccessDialog } from './SelectionSuccessDialog';
import { VotingSubmitFooter } from './VotingSubmitFooter';
import { useManualSelectionDraft } from './useManualSelectionDraft';
import { useProposalFilters } from './useProposalFilters';

// Stable reference: useProposalFilters memoizes on `votedProposalIds`.
const EMPTY_VOTED_IDS: string[] = [];

interface ManualSelectionListProps {
  instanceId: string;
  slug: string;
}

export const ManualSelectionList = ({
  instanceId,
  slug,
}: ManualSelectionListProps) => {
  const t = useTranslations();
  const { user } = useUser();

  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const categoryId =
    selectedCategory === 'all-categories' ? undefined : selectedCategory;

  const [[categoriesData, instance]] = trpc.useSuspenseQueries((q) => [
    q.decision.getCategories({ processInstanceId: instanceId }),
    q.decision.getInstance({ instanceId }),
  ]);

  // Non-suspense + placeholderData so category/sort changes don't blank
  // the table while the server re-fetches.
  const stateQuery = trpc.decision.getManualSelectionState.useQuery(
    { processInstanceId: instanceId, categoryId, sortOrder },
    { placeholderData: (prev) => prev },
  );
  const state = stateQuery.data;

  // Store full Proposals (not just ids) so selections survive filter changes.
  // Backed by sessionStorage so they also survive back-navigation.
  const [selectedProposals, setSelectedProposals] =
    useManualSelectionDraft(instanceId);
  const selectedIds = selectedProposals.map((p) => p.id);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const { filteredProposals, proposalFilter, setProposalFilter } =
    useProposalFilters({
      proposals: state?.proposals ?? [],
      currentProfileId: user.currentProfile?.id,
      votedProposalIds: EMPTY_VOTED_IDS,
      hasVoted: false,
      initialFilter: ProposalFilter.ALL,
    });

  const categories = categoriesData.categories;
  const proposals = filteredProposals;

  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: () => {
      setSuccessCount(selectedIds.length);
      setSelectedProposals([]);
      setIsConfirmOpen(false);
      setSubmitError(null);
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      setSubmitError(error.message);
    },
  });

  // Invalidation is automatic via the shared realtime channel.
  const dismissSuccess = () => {
    setSuccessCount(null);
  };

  if (!state) {
    return null;
  }

  // Keep the success modal mounted past the realtime invalidation that
  // flips selectionsConfirmed.
  if (successCount !== null) {
    return (
      <SelectionSuccessDialog count={successCount} onClose={dismissSuccess} />
    );
  }

  if (state.selectionsConfirmed) {
    return null;
  }

  // Unfiltered-empty → "nothing to select". Filtered-empty keeps the
  // toolbar so the admin can clear the filter.
  if (!categoryId && state.proposals.length === 0) {
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
    setSelectedProposals((prev) => {
      if (prev.some((p) => p.id === proposalId)) {
        return prev.filter((p) => p.id !== proposalId);
      }
      const match = proposals.find((p) => p.id === proposalId);
      if (!match) return prev;
      return [...prev, match];
    });
  };

  const numSelected = selectedProposals.length;
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

      <SelectableProposalsTable
        proposals={proposals}
        selectedIds={selectedIds}
        onToggle={toggleProposal}
        getProposalHref={(p) =>
          `/profile/${slug}/decisions/${instanceId}/proposal/${p.profileId}`
        }
      />

      {submitError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-functional-red bg-functional-red/10 p-4 text-base text-functional-red"
        >
          <LuTriangleAlert className="mt-0.5 size-5 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <VotingSubmitFooter isVisible>
        <div className="flex w-full items-center justify-between px-4 sm:max-w-6xl sm:px-8">
          <span className="text-neutral-black">
            {t('{count} proposals advancing', { count: numSelected })}
          </span>
          <SelectionConfirmDialog
            isOpen={isConfirmOpen}
            onOpenChange={setIsConfirmOpen}
            proposals={selectedProposals}
            count={numSelected}
            phaseName={currentPhaseName}
            triggerDisabled={numSelected === 0}
            isSubmitting={submitMutation.isPending}
            onConfirm={() =>
              submitMutation.mutate({
                processInstanceId: instanceId,
                proposalIds: selectedIds,
              })
            }
          />
        </div>
      </VotingSubmitFooter>
    </div>
  );
};
