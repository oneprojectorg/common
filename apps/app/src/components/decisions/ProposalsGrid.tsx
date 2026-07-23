'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { type DecisionAccess, ProposalStatus } from '@op/api/encoders';
import { type Proposal, isVotingEligible } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button, ButtonLink } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { FooterBar } from '@op/ui/FooterBar';
import { Header3 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalCard,
  ProposalCardActions,
  ProposalCardContent,
  ProposalCardFooter,
  ProposalCardHeader,
  ProposalCardMenu,
  ProposalCardMeta,
  ProposalCardMetrics,
  ProposalCardOwnerActions,
  ProposalCardPreview,
  ProposalCardReviseAction,
} from './ProposalCard';
import { ProposalMasonry } from './ProposalMasonry';
import { VoteSubmissionModal } from './VoteSubmissionModal';
import { VoteSuccessModal } from './VoteSuccessModal';
import { VotingProposalCard } from './VotingProposalCard';
import {
  CustomFormModal,
  type CustomFormValues,
} from './proposalEditor/CustomFormModal';

export interface ProposalsProps {
  proposals?: Proposal[];
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  permissions?: DecisionAccess | null;
  votedProposalIds?: string[];
  hasFilter: boolean;
  /** When true, the current phase has voting enabled — always show voting UI */
  isVotingPhase?: boolean;
  /** When true, new proposals are hidden by default in the current phase. */
  proposalsHidden?: boolean;
  /**
   * When true, this list is the reviewer's "Other proposals" tab (proposals
   * outside their review queue). Tailors the empty state — the generic
   * "submit the first proposal" copy is wrong here.
   */
  excludeAssignedForReview?: boolean;
}

export const ProposalsGrid = ({
  revisionRequestIdByProposalId,
  ...props
}: ProposalsProps & {
  revisionRequestIdByProposalId?: Map<string, string>;
}) => {
  const { instanceId, isVotingPhase } = props;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

  // Use the phase capability passed from the router, falling back to the
  // voting status endpoint for backwards compatibility
  const isVotingEnabled =
    isVotingPhase || !!voteStatus?.votingConfiguration?.allowDecisions;

  if (isVotingEnabled) {
    return <VotingProposalsList {...props} />;
  }

  return (
    <ViewProposalsList
      {...props}
      revisionRequestIdByProposalId={revisionRequestIdByProposalId}
    />
  );
};

const NoProposalsFound = ({
  hasFilter,
  excludeAssignedForReview,
}: {
  hasFilter: boolean;
  excludeAssignedForReview?: boolean;
}) => {
  const t = useTranslations();

  // The reviewer's "Other proposals" tab is empty because every proposal is in
  // their review queue (or none exist yet) — not because nobody has submitted.
  if (excludeAssignedForReview && !hasFilter) {
    return (
      <EmptyState icon={<LuLeaf className="size-6" />}>
        <Header3 className="font-serif !text-title-base font-light text-neutral-black">
          {t('No other proposals')}
        </Header3>
        <p className="text-base text-neutral-charcoal">
          {t('There are no proposals outside your review queue.')}
        </p>
      </EmptyState>
    );
  }

  return (
    <EmptyState icon={<LuLeaf className="size-6" />}>
      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
        {hasFilter
          ? t('No proposals found matching the current filters.')
          : t('No proposals yet')}
      </Header3>
      <p className="text-base text-neutral-charcoal">
        {hasFilter
          ? t('Try adjusting your filter selection above.')
          : t('You could be the first one to submit a proposal')}
      </p>
    </EmptyState>
  );
};

const HiddenProposalsEmptyState = () => {
  const t = useTranslations();

  return (
    <EmptyState icon={<LuLeaf className="size-6" />}>
      <p className="text-base text-neutral-charcoal">
        {t("You'll see your proposal here once you submit.")}
      </p>
    </EmptyState>
  );
};

const VotingProposalsList = ({
  proposals,
  instanceId,
  slug,
  decisionSlug,
  permissions,
  votedProposalIds = [],
  hasFilter,
  proposalsHidden,
}: ProposalsProps) => {
  const canVote = permissions?.vote ?? false;
  const canManageProposals = permissions?.admin ?? false;
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPhaseFormModal, setShowPhaseFormModal] = useState(false);
  const t = useTranslations();

  const numSelected = selectedProposalIds.length;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

  // Instance context for resolving the current phase's optional custom form.
  const { data: instance } = trpc.decision.getInstance.useQuery({ instanceId });
  const decisionProfileId = instance?.profileId ?? undefined;
  const currentPhaseId = instance?.currentStateId ?? undefined;
  const initialPhaseId = instance?.instanceData?.phases?.[0]?.phaseId;

  // A form tagged for the current (voting) phase, attached to the decision
  // profile — same lookup the proposal editor uses, scoped by phase.
  const { data: phaseForm } = trpc.customForm.getForProfile.useQuery(
    {
      profileId: decisionProfileId ?? '',
      phaseId: currentPhaseId,
      initialPhaseId,
    },
    { enabled: Boolean(decisionProfileId) && Boolean(currentPhaseId) },
  );

  const { user } = useUser();
  const voterProfileId = user?.profileId;

  const submitPhaseFormMutation = trpc.customForm.submit.useMutation();

  const utils = trpc.useUtils();

  // Determine voting state
  const hasVoted = voteStatus?.hasVoted || false;
  const isReadOnly = hasVoted || !canVote;
  const maxVotesPerMember = voteStatus?.votingConfiguration?.maxVotesPerMember;

  const toggleProposal = (proposalId: string) => {
    setSelectedProposalIds((prev) => {
      const isSelected = prev.includes(proposalId);

      if (isSelected) {
        return prev.filter((id) => id !== proposalId);
      }
      if (maxVotesPerMember === undefined || prev.length < maxVotesPerMember) {
        return [...prev, proposalId];
      }
      return prev;
    });
  };

  const isProposalSelected = (proposalId: string) =>
    selectedProposalIds.includes(proposalId);

  // Get selected proposals for the modal
  const selectedProposals =
    proposals?.filter((p) => selectedProposalIds.includes(p.id)) || [];

  // Handle successful vote submission
  const handleVoteSuccess = () => {
    setSelectedProposalIds([]);
    utils.decision.getVotingStatus.invalidate({
      processInstanceId: instanceId,
    });
    // When the voting phase has a custom form, collect it before the success
    // confirmation; otherwise show the confirmation directly.
    if (phaseForm && voterProfileId) {
      setShowPhaseFormModal(true);
    } else {
      setShowSuccessModal(true);
    }
  };

  // Store the post-vote form submission (attached to the voter's own profile),
  // then continue to the success confirmation.
  const handlePhaseFormSubmit = async (values: CustomFormValues) => {
    if (!phaseForm || !voterProfileId) {
      return;
    }
    try {
      await submitPhaseFormMutation.mutateAsync({
        customFormId: phaseForm.id,
        profileId: voterProfileId,
        data: values,
      });
    } catch (error) {
      logger.error('Failed to submit phase form', {
        error,
        context: 'ProposalsGrid.handlePhaseFormSubmit',
      });
      toast.error({ message: t('Failed to submit form') });
      return; // Keep the modal open so the user can retry.
    }
    setShowPhaseFormModal(false);
    setShowSuccessModal(true);
  };

  // The form is optional — dismissing it still confirms the vote.
  const handlePhaseFormOpenChange = (open: boolean) => {
    if (submitPhaseFormMutation.isPending) {
      return;
    }
    setShowPhaseFormModal(open);
    if (!open) {
      setShowSuccessModal(true);
    }
  };

  if (!proposals || proposals.length === 0) {
    if (proposalsHidden && !hasFilter) {
      return <HiddenProposalsEmptyState />;
    }
    return <NoProposalsFound hasFilter={hasFilter} />;
  }

  return (
    <>
      <ProposalMasonry>
        {proposals.map((proposal) => {
          const isSelected = isProposalSelected(proposal.id);
          const isEligibleForVote = isVotingEligible(proposal.status);
          const isVotedFor = votedProposalIds.includes(proposal.id);
          const showCheckbox = !isReadOnly || isVotedFor;

          const proposalHref = decisionSlug
            ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
            : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`;

          // Ballot view: after voting, show a simpler card with clickable title
          if (isEligibleForVote && isReadOnly) {
            return (
              <VotingProposalCard
                key={proposal.id}
                proposalId={proposal.id}
                isSelected={isVotedFor}
                isVotedFor={isVotedFor}
              >
                <ProposalCardContent>
                  <ProposalCardHeader
                    proposal={proposal}
                    viewHref={proposalHref}
                    menu={
                      isVotedFor ? (
                        <Checkbox
                          isSelected={true}
                          shape="circle"
                          borderColor="light"
                          className="[&[data-disabled]_svg]:!text-white"
                          aria-label={t('Selected proposal')}
                          isDisabled
                        />
                      ) : undefined
                    }
                  />
                  <ProposalCardMeta proposal={proposal} />
                  <ProposalCardPreview proposal={proposal} />
                </ProposalCardContent>
              </VotingProposalCard>
            );
          }

          // Active voting view: interactive cards with selection
          if (isEligibleForVote) {
            return (
              <VotingProposalCard
                key={proposal.id}
                proposalId={proposal.id}
                isVotingEnabled={true}
                isReadOnly={isReadOnly}
                isSelected={isSelected}
                isVotedFor={isVotedFor}
                onToggle={toggleProposal}
              >
                <ProposalCardContent>
                  <ProposalCardHeader
                    proposal={proposal}
                    menu={
                      (canManageProposals ||
                        proposal.isEditable ||
                        showCheckbox) && (
                        <div className="flex items-center gap-2">
                          {(canManageProposals || proposal.isEditable) && (
                            <ProposalCardMenu
                              proposal={proposal}
                              canManage={canManageProposals}
                            />
                          )}
                          {showCheckbox && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                isSelected={isSelected}
                                onChange={() => {
                                  toggleProposal(proposal.id);
                                }}
                                shape="circle"
                                borderColor="light"
                                aria-label={
                                  isSelected
                                    ? t('Deselect proposal')
                                    : t('Select proposal')
                                }
                              />
                            </div>
                          )}
                        </div>
                      )
                    }
                  />
                  <ProposalCardMeta withLink={false} proposal={proposal} />
                  <ProposalCardPreview proposal={proposal} />
                </ProposalCardContent>
                <ProposalCardFooter>
                  <ButtonLink
                    href={proposalHref}
                    color="secondary"
                    className="w-full"
                  >
                    {t('Read full proposal')}
                  </ButtonLink>
                </ProposalCardFooter>
              </VotingProposalCard>
            );
          } else {
            return (
              <ProposalCard key={proposal.id} proposal={proposal}>
                <div className="flex flex-col justify-between gap-3 space-y-3">
                  <ProposalCardContent>
                    <ProposalCardHeader
                      proposal={proposal}
                      menu={
                        (canManageProposals || proposal.isEditable) && (
                          <ProposalCardMenu
                            proposal={proposal}
                            canManage={canManageProposals}
                          />
                        )
                      }
                    />
                    <ProposalCardMeta proposal={proposal} />
                    <ProposalCardPreview proposal={proposal} />
                  </ProposalCardContent>
                </div>
                <ProposalCardContent>
                  <ProposalCardFooter>
                    <ButtonLink
                      href={proposalHref}
                      color="secondary"
                      className="w-full"
                    >
                      {t('Read full proposal')}
                    </ButtonLink>
                  </ProposalCardFooter>
                </ProposalCardContent>
              </ProposalCard>
            );
          }
        })}
      </ProposalMasonry>

      {canVote && !isReadOnly && (
        <FooterBar position="fixed" className="bg-neutral-offWhite/95">
          <FooterBar.Start>
            <span className="text-base text-neutral-black">
              {maxVotesPerMember !== undefined
                ? t.rich(
                    '<highlight>{numSelected}</highlight> of {max, plural, one {# proposal} other {# proposals}} selected',
                    {
                      numSelected,
                      max: maxVotesPerMember,
                      highlight: (chunks: React.ReactNode) => (
                        <span className="text-primary-teal">{chunks}</span>
                      ),
                    },
                  )
                : t.rich(
                    '<highlight>{numSelected, plural, one {# proposal} other {# proposals}}</highlight> selected',
                    {
                      numSelected,
                      highlight: (chunks: React.ReactNode) => (
                        <span className="text-primary-teal">{chunks}</span>
                      ),
                    },
                  )}
            </span>
          </FooterBar.Start>
          <FooterBar.Center />
          <FooterBar.End>
            <DialogTrigger>
              <Button isDisabled={numSelected === 0} variant="primary">
                {t('Submit my votes')}
              </Button>

              <Modal isDismissable>
                <Dialog className="h-full">
                  <VoteSubmissionModal
                    selectedProposals={selectedProposals}
                    instanceId={instanceId}
                    onSuccess={handleVoteSuccess}
                  />
                </Dialog>
              </Modal>
            </DialogTrigger>
          </FooterBar.End>
        </FooterBar>
      )}

      {phaseForm && (
        <CustomFormModal
          isOpen={showPhaseFormModal}
          schema={phaseForm.schema}
          isSubmitting={submitPhaseFormMutation.isPending}
          onSubmit={handlePhaseFormSubmit}
          onOpenChange={handlePhaseFormOpenChange}
        />
      )}

      <VoteSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        instanceId={instanceId}
      />
    </>
  );
};

const ViewProposalsList = ({
  proposals,
  instanceId,
  slug,
  decisionSlug,
  permissions,
  hasFilter,
  proposalsHidden,
  excludeAssignedForReview,
  revisionRequestIdByProposalId,
}: ProposalsProps & {
  revisionRequestIdByProposalId?: Map<string, string>;
}) => {
  const canManageProposals = permissions?.admin ?? false;
  if (!proposals || proposals.length === 0) {
    if (proposalsHidden && !hasFilter) {
      return <HiddenProposalsEmptyState />;
    }
    return (
      <NoProposalsFound
        hasFilter={hasFilter}
        excludeAssignedForReview={excludeAssignedForReview}
      />
    );
  }

  return (
    <ProposalMasonry>
      {proposals.map((proposal) => {
        const isDraft = proposal.status === ProposalStatus.DRAFT;
        const isEditable = Boolean(proposal.isEditable);
        const showMenu = canManageProposals || isEditable;
        const revisionRequestId = revisionRequestIdByProposalId?.get(
          proposal.id,
        );
        const hasRevisionRequest = revisionRequestId !== undefined;
        // Use new route structure if decisionSlug is provided, otherwise fallback to legacy route
        const editHref = decisionSlug
          ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`
          : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}/edit`;
        const reviseHref = revisionRequestId
          ? `${editHref}?reviewRevision=${revisionRequestId}`
          : editHref;
        const viewHref = decisionSlug
          ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
          : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`;

        return (
          <ProposalCard key={proposal.id} proposal={proposal}>
            <div className="flex h-full flex-col justify-between gap-3 space-y-3">
              <ProposalCardContent>
                <ProposalCardHeader
                  proposal={proposal}
                  viewHref={viewHref}
                  menu={
                    showMenu && (
                      <ProposalCardMenu
                        proposal={proposal}
                        canManage={canManageProposals}
                      />
                    )
                  }
                />
                <ProposalCardMeta
                  proposal={proposal}
                  revisionRequested={hasRevisionRequest}
                />
                <ProposalCardPreview proposal={proposal} />
              </ProposalCardContent>
            </div>
            <ProposalCardContent>
              <ProposalCardFooter>
                {hasRevisionRequest ? (
                  <>
                    <ProposalCardMetrics proposal={proposal} />
                    <ProposalCardReviseAction editHref={reviseHref} />
                  </>
                ) : isDraft ? (
                  <ProposalCardOwnerActions
                    proposal={proposal}
                    editHref={editHref}
                  />
                ) : isEditable ? (
                  <>
                    <ProposalCardMetrics proposal={proposal} />
                    <ProposalCardOwnerActions
                      proposal={proposal}
                      editHref={editHref}
                    />
                  </>
                ) : (
                  <>
                    <ProposalCardMetrics proposal={proposal} />
                    <ProposalCardActions proposal={proposal} />
                  </>
                )}
              </ProposalCardFooter>
            </ProposalCardContent>
          </ProposalCard>
        );
      })}
    </ProposalMasonry>
  );
};
