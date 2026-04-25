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
  const utils = trpc.useUtils();

  // Non-suspense + placeholderData so category/sort changes don't blank
  // the table while the server re-fetches.
  const candidatesQuery = trpc.decision.listSelectionCandidates.useQuery(
    { processInstanceId: instanceId, categoryId, sortOrder },
    { placeholderData: (prev) => prev },
  );
  const candidates = candidatesQuery.data;

  const [selectedProposals, setSelectedProposals] =
    useManualSelectionDraft(instanceId);
  const selectedIds = selectedProposals.map((p) => p.id);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Await invalidation before closing the modal to enforce synchronous
  // behavior. Realtime channels still invalidate too, but waiting here
  // guarantees selectionsAreConfirmed has flipped before the modal closes —
  // without this we briefly render the empty-state during the channel race.
  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: async () => {
      await utils.decision.getInstance.invalidate({ instanceId });
      setSelectedProposals([]);
      setIsConfirmOpen(false);
      setSubmitError(null);
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      setSubmitError(error.message);
    },
  });

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
    if (selectedProposals.some((p) => p.id === proposalId)) {
      setSelectedProposals(
        selectedProposals.filter((p) => p.id !== proposalId),
      );
      return;
    }
    const match = proposals.find((p) => p.id === proposalId);
    if (match) {
      setSelectedProposals([...selectedProposals, match]);
    }
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
            `/profile/${slug}/decisions/${instanceId}/proposal/${p.profileId}`
          }
        />
      )}

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
