'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { useMemo, useState } from 'react';
import { LuLeaf, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ManualSelectionToolbar } from './ManualSelectionToolbar';
import { SelectableProposalsTable } from './SelectableProposalsTable';
import { SelectionConfirmDialog } from './SelectionConfirmDialog';
import { SelectionSuccessDialog } from './SelectionSuccessDialog';
import { VotingSubmitFooter } from './VotingSubmitFooter';
import { useProposalFilters } from './useProposalFilters';

const EMPTY_VOTED_IDS: string[] = [];
const EMPTY_PROPOSALS: Proposal[] = [];

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

  // Intentionally NOT a suspense query: the input includes `categoryId`,
  // so a suspense query would re-suspend every time the admin changes the
  // category filter and blank out the data table while the server
  // re-fetches. `placeholderData: (prev) => prev` keeps the previous
  // result visible during the refetch so only the table contents swap in
  // place. `isFetching` could be surfaced as a subtle loading indicator
  // if needed; `data` is only undefined on the very first render.
  const stateQuery = trpc.decision.getManualSelectionState.useQuery(
    { processInstanceId: instanceId, categoryId },
    { placeholderData: (prev) => prev },
  );
  const state = stateQuery.data;

  // Track the full Proposal objects so selections persist across category
  // filter changes — when filtered out of the visible table, a selected
  // proposal still surfaces in the footer count and confirm-dialog list.
  const [selectedProposals, setSelectedProposals] = useState<Proposal[]>([]);
  const selectedIds = selectedProposals.map((p) => p.id);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const { filteredProposals, proposalFilter, setProposalFilter } =
    useProposalFilters({
      proposals: state?.proposals ?? EMPTY_PROPOSALS,
      currentProfileId: user.currentProfile?.id,
      votedProposalIds: EMPTY_VOTED_IDS,
      hasVoted: false,
      initialFilter: ProposalFilter.ALL,
    });

  const categories = categoriesData.categories;

  const proposals = useMemo(() => {
    const dir = sortOrder === 'newest' ? -1 : 1;
    return [...filteredProposals].sort(
      (a, b) => dir * (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    );
  }, [filteredProposals, sortOrder]);

  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: () => {
      setSuccessCount(selectedIds.length);
      setIsConfirmOpen(false);
      setSubmitError(null);
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      setSubmitError(error.message);
    },
  });

  // Cache invalidation is handled automatically: submitManualSelection's
  // router registers `decisionInstance(id)` as a mutation channel, and
  // both getInstance and getManualSelectionState register it as a query
  // channel. QueryInvalidationSubscriber invalidates matching queries the
  // moment the mutation response comes back — no manual utils.invalidate
  // needed here.
  const dismissSuccess = () => {
    setSuccessCount(null);
  };

  // First render: state is undefined because getManualSelectionState is a
  // non-suspense query. Subsequent renders always have data (either real or
  // kept from the previous fetch via placeholderData).
  if (!state) {
    return null;
  }

  // Keep the success modal mounted until the admin dismisses it, even
  // though the realtime invalidation has already flipped
  // state.selectionsConfirmed to true. Rendering only the success dialog
  // also avoids a flash of the now-stale toolbar/table during dismissal.
  if (successCount !== null) {
    return (
      <SelectionSuccessDialog count={successCount} onClose={dismissSuccess} />
    );
  }

  if (state.selectionsConfirmed) {
    return null;
  }

  // Only the unfiltered-empty case means "the previous phase produced
  // nothing". A filtered-empty case (a category with no matches) should
  // still render the toolbar so the admin can clear the filter.
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
