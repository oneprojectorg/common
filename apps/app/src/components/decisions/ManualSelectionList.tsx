'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { Header1, Header3 } from '@op/ui/Header';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { useMemo, useState } from 'react';
import { LuLeaf, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import {
  ProposalCard,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
} from './ProposalCard';
import { ResponsiveSelect } from './ResponsiveSelect';
import { SelectableProposalsTable } from './SelectableProposalsTable';
import { VotingSubmitFooter } from './VotingSubmitFooter';
import { useProposalFilters } from './useProposalFilters';

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

  const currentPhaseName =
    instance.instanceData?.phases?.find(
      (p) => p.phaseId === instance.currentStateId,
    )?.name ?? '';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<string>('all-categories');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const utils = trpc.useUtils();
  // Invalidation intentionally runs when the success modal is dismissed —
  // invalidating in onSuccess flips `selectionsConfirmed` to true, which
  // causes this component to early-return null and unmounts the success
  // modal mid-render.
  const dismissSuccess = () => {
    setSuccessCount(null);
    utils.decision.getInstance.invalidate({ instanceId });
    utils.decision.getManualSelectionState.invalidate({
      processInstanceId: instanceId,
    });
  };
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

  const allProposals = state.proposals;
  const categories = categoriesData.categories;

  const { filteredProposals, proposalFilter, setProposalFilter } =
    useProposalFilters({
      proposals: allProposals,
      currentProfileId: user.currentProfile?.id,
      votedProposalIds: [],
      hasVoted: false,
      initialFilter: ProposalFilter.ALL,
    });

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

  if (state.selectionsConfirmed) {
    return null;
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
  const canSubmit = numSelected > 0;

  const submitLabel = t('Publish results');

  return (
    <div className="flex flex-col gap-6 pb-20">
      {allProposals.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {t('No proposals available to select')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {t('The previous phase did not leave any eligible proposals.')}
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-serif text-title-base text-neutral-black">
              {t('All proposals')} <Bullet /> {proposals.length}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <ResponsiveSelect
                selectedKey={proposalFilter}
                onSelectionChange={(key) => {
                  if (
                    key === ProposalFilter.MY_PROPOSALS &&
                    !user.currentProfile?.id
                  ) {
                    return;
                  }
                  setProposalFilter(key);
                }}
                aria-label={t('Filter proposals')}
                items={[
                  { id: ProposalFilter.ALL, label: t('All proposals') },
                  {
                    id: ProposalFilter.MY_PROPOSALS,
                    label: t('My proposals'),
                    isDisabled: !user.currentProfile?.id,
                  },
                  {
                    id: ProposalFilter.SHORTLISTED,
                    label: t('Shortlisted proposals'),
                  },
                ]}
              />
              <ResponsiveSelect
                selectedKey={selectedCategory}
                onSelectionChange={setSelectedCategory}
                aria-label={t('Filter proposals by category')}
                items={[
                  { id: 'all-categories', label: t('All categories') },
                  ...categories.map((category) => ({
                    id: category.id,
                    label: category.name,
                  })),
                ]}
              />
              <ResponsiveSelect
                selectedKey={sortOrder}
                onSelectionChange={setSortOrder}
                aria-label={t('Sort proposals')}
                items={[
                  { id: 'newest', label: t('Newest First') },
                  { id: 'oldest', label: t('Oldest First') },
                ]}
              />
            </div>
          </div>

          <SelectableProposalsTable
            proposals={proposals}
            selectedIds={selectedIds}
            onToggle={toggleProposal}
            getProposalHref={(proposal) =>
              `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`
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

              <DialogTrigger
                isOpen={isConfirmOpen}
                onOpenChange={setIsConfirmOpen}
              >
                <Button isDisabled={!canSubmit} variant="primary">
                  {t('Confirm decisions')}
                </Button>

                <Modal isDismissable>
                  <Dialog className="h-full">
                    <ModalHeader>
                      {t('Confirm advancing proposals')}
                    </ModalHeader>
                    <ModalBody>
                      <SelectedProposalsReview
                        proposals={selectedProposals}
                        count={numSelected}
                        phaseName={currentPhaseName}
                      />
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        className="w-full"
                        color="primary"
                        onPress={() =>
                          submitMutation.mutate({
                            processInstanceId: instanceId,
                            proposalIds: selectedIds,
                          })
                        }
                        isDisabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending
                          ? t('Submitting...')
                          : submitLabel}
                      </Button>
                    </ModalFooter>
                  </Dialog>
                </Modal>
              </DialogTrigger>
            </div>
          </VotingSubmitFooter>

          <DialogTrigger
            isOpen={successCount !== null}
            onOpenChange={(open) => {
              if (!open) {
                dismissSuccess();
              }
            }}
          >
            <Modal isDismissable confetti>
              <div className="z-10 p-12 text-center">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex size-16 flex-col items-center justify-center gap-4">
                      <CheckIcon />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Header1 className="font-serif text-2xl font-light">
                        {t('Selection recorded')}
                      </Header1>
                      <p className="text-base text-neutral-charcoal">
                        {t(
                          '{count} proposals are now attached to this phase. Participants can view them on the decision page.',
                          { count: successCount ?? 0 },
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onPress={dismissSuccess}
                    color="primary"
                    className="w-full"
                  >
                    {t('Done')}
                  </Button>
                </div>
              </div>
            </Modal>
          </DialogTrigger>
        </>
      )}
    </div>
  );
};

const SelectedProposalsReview = ({
  proposals,
  count,
  phaseName,
}: {
  proposals: Proposal[];
  count: number;
  phaseName: string;
}) => {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-charcoal">
        {t(
          'These {numProposals} proposals will move on to the {phaseName} phase',
          { numProposals: count, phaseName },
        )}
      </p>

      <div className="space-y-2">
        <div className="text-sm tracking-wider text-neutral-gray4 uppercase">
          {t('PROPOSALS TO ADVANCE')}
        </div>

        {proposals.map((proposal) => (
          <ProposalCard className="bg-neutral-offWhite p-3" key={proposal.id}>
            <ProposalCardContent>
              <ProposalCardHeader
                className="flex-row flex-wrap justify-between"
                proposal={proposal}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-charcoal">
                  {proposal.submittedBy?.name}
                </span>
                <ProposalCardCategory proposal={proposal} />
              </div>
            </ProposalCardContent>
          </ProposalCard>
        ))}
      </div>
    </div>
  );
};
