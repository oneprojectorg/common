'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
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

  const [[state, categoriesData, instance]] = trpc.useSuspenseQueries((q) => [
    q.decision.getManualSelectionState({ processInstanceId: instanceId }),
    q.decision.getCategories({ processInstanceId: instanceId }),
    q.decision.getInstance({ instanceId }),
  ]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const { filteredProposals, proposalFilter, setProposalFilter } =
    useProposalFilters({
      proposals: state.proposals,
      currentProfileId: user.currentProfile?.id,
      votedProposalIds: EMPTY_VOTED_IDS,
      hasVoted: false,
      initialFilter: ProposalFilter.ALL,
    });

  const categories = categoriesData.categories;

  const proposals = useMemo(() => {
    let filtered = filteredProposals;
    if (selectedCategory !== 'all-categories') {
      const selected = categories.find((c) => c.id === selectedCategory);
      if (selected) {
        filtered = filtered.filter((p) =>
          (p.proposalData?.category ?? []).some(
            (token) =>
              token === selected.name ||
              token === selected.id ||
              token === selected.termUri,
          ),
        );
      }
    }
    const dir = sortOrder === 'newest' ? -1 : 1;
    return [...filtered].sort(
      (a, b) => dir * (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    );
  }, [filteredProposals, categories, selectedCategory, sortOrder]);

  const utils = trpc.useUtils();
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

  // Invalidation is deferred to the success-modal dismiss handler so the
  // modal stays mounted — invalidating in onSuccess flips
  // `selectionsConfirmed` to true, causing this component to early-return
  // null and unmounting the modal mid-render.
  const dismissSuccess = () => {
    setSuccessCount(null);
    utils.decision.getInstance.invalidate({ instanceId });
    utils.decision.getManualSelectionState.invalidate({
      processInstanceId: instanceId,
    });
  };

  if (state.selectionsConfirmed) {
    return null;
  }

  if (state.proposals.length === 0) {
    return (
      <EmptyState icon={<LuLeaf className="size-6" />}>
        <Header3 className="font-serif !text-title-base font-light text-neutral-black">
          {t('No proposals available to select')}
        </Header3>
        <p className="text-base text-neutral-charcoal">
          {t('The previous phase did not leave any eligible proposals.')}
        </p>
      </EmptyState>
    );
  }

  const toggleProposal = (proposalId: string) => {
    setSelectedIds((prev) =>
      prev.includes(proposalId)
        ? prev.filter((id) => id !== proposalId)
        : [...prev, proposalId],
    );
  };

  const selectedProposals = proposals.filter((p) => selectedIds.includes(p.id));
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

      <SelectionSuccessDialog count={successCount} onClose={dismissSuccess} />
    </div>
  );
};
