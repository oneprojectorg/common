'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import { type DecisionAccess, ProposalStatus } from '@op/api/encoders';
import { type Proposal, isVotingEligible } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { Dialog, DialogContent, DialogTrigger } from '@op/sense/Dialog';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@op/sense/Empty';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import {
  ProposalCardActions,
  ProposalCardMenu,
  ProposalCardOwnerActions,
  ProposalCardReviseAction,
  ProposalCardView,
} from './ProposalCard';
import { ProposalMasonry } from './ProposalMasonry';
import { VoteSubmissionModal } from './VoteSubmissionModal';
import { VoteSuccessModal } from './VoteSuccessModal';
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
  /** Reviewer's "Other proposals" tab — tailors the empty state. */
  excludeAssignedForReview?: boolean;
  /** Next page fetching — appends loading skeletons into the masonry. */
  isFetchingNextPage?: boolean;
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

  if (excludeAssignedForReview && !hasFilter) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLeaf className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('No other proposals')}</EmptyTitle>
          <EmptyDescription>
            {t('There are no proposals outside your review queue.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>
          {hasFilter
            ? t('No proposals found matching the current filters.')
            : t('No proposals yet')}
        </EmptyTitle>
        <EmptyDescription>
          {hasFilter
            ? t('Try adjusting your filter selection above.')
            : t('You could be the first one to submit a proposal')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

const HiddenProposalsEmptyState = () => {
  const t = useTranslations();

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyDescription>
          {t("You'll see your proposal here once you submit.")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
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
  excludeAssignedForReview,
  isFetchingNextPage,
}: ProposalsProps) => {
  const canVote = permissions?.vote ?? false;
  const canManageProposals = permissions?.admin ?? false;
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [isVoteReviewOpen, setIsVoteReviewOpen] = useState(false);
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
    // The review dialog is controlled here (sense Dialog has no descendant
    // close API), so dismiss it before the success confirmation opens.
    setIsVoteReviewOpen(false);
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
      toast.error(t('Failed to submit form'));
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
    return (
      <NoProposalsFound
        hasFilter={hasFilter}
        excludeAssignedForReview={excludeAssignedForReview}
      />
    );
  }

  return (
    <>
      <ProposalMasonry loadingMore={isFetchingNextPage}>
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
              <ProposalCardView
                key={proposal.id}
                proposal={proposal}
                href={proposalHref}
                selected={isVotedFor}
                showStatusBadge={false}
                aside={
                  isVotedFor ? (
                    // TODO(sense-migration): sense Checkbox has no
                    // shape="circle"/borderColor; approximated with
                    // rounded-full — revisit against Figma vote design.
                    <Checkbox
                      checked
                      disabled
                      aria-label={t('Selected proposal')}
                      className="rounded-full"
                    />
                  ) : undefined
                }
              />
            );
          }

          // Active voting view: the whole card is a selection toggle.
          if (isEligibleForVote) {
            return (
              <ProposalCardView
                key={proposal.id}
                proposal={proposal}
                selected={isSelected}
                showStatusBadge={false}
                role="button"
                aria-pressed={isSelected}
                aria-label={
                  isSelected ? t('Deselect proposal') : t('Select proposal')
                }
                onClick={() => toggleProposal(proposal.id)}
                className="cursor-pointer"
                aside={
                  canManageProposals || proposal.isEditable || showCheckbox ? (
                    <div className="flex items-center gap-2">
                      {(canManageProposals || proposal.isEditable) && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ProposalCardMenu
                            proposal={proposal}
                            canManage={canManageProposals}
                          />
                        </div>
                      )}
                      {showCheckbox && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {/* TODO(sense-migration): sense Checkbox has no
                              shape="circle"/borderColor; approximated with
                              rounded-full — revisit against Figma. */}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              toggleProposal(proposal.id);
                            }}
                            aria-label={
                              isSelected
                                ? t('Deselect proposal')
                                : t('Select proposal')
                            }
                            className="rounded-full"
                          />
                        </div>
                      )}
                    </div>
                  ) : undefined
                }
                actions={
                  <ButtonLink
                    href={proposalHref}
                    variant="outline"
                    className="w-full"
                  >
                    {t('Read full proposal')}
                  </ButtonLink>
                }
              />
            );
          } else {
            return (
              <ProposalCardView
                key={proposal.id}
                proposal={proposal}
                aside={
                  canManageProposals || proposal.isEditable ? (
                    <ProposalCardMenu
                      proposal={proposal}
                      canManage={canManageProposals}
                    />
                  ) : undefined
                }
                actions={
                  <ButtonLink
                    href={proposalHref}
                    variant="outline"
                    className="w-full"
                  >
                    {t('Read full proposal')}
                  </ButtonLink>
                }
              />
            );
          }
        })}
      </ProposalMasonry>

      {canVote && !isReadOnly && (
        <FooterBar position="fixed" className="bg-neutral-offWhite/95">
          <FooterBarStart>
            <span className="text-base text-neutral-black">
              {maxVotesPerMember !== undefined
                ? t.rich(
                    '<highlight>{numSelected}</highlight> of {max, plural, one {# proposal} other {# proposals}} selected',
                    {
                      numSelected,
                      max: maxVotesPerMember,
                      highlight: (chunks: ReactNode) => (
                        <span className="text-primary-teal">{chunks}</span>
                      ),
                    },
                  )
                : t.rich(
                    '<highlight>{numSelected, plural, one {# proposal} other {# proposals}}</highlight> selected',
                    {
                      numSelected,
                      highlight: (chunks: ReactNode) => (
                        <span className="text-primary-teal">{chunks}</span>
                      ),
                    },
                  )}
            </span>
          </FooterBarStart>
          <FooterBarCenter />
          <FooterBarEnd>
            <Dialog open={isVoteReviewOpen} onOpenChange={setIsVoteReviewOpen}>
              <DialogTrigger
                render={
                  <Button disabled={numSelected === 0} variant="default">
                    {t('Submit my votes')}
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-2xl">
                <VoteSubmissionModal
                  selectedProposals={selectedProposals}
                  instanceId={instanceId}
                  onSuccess={handleVoteSuccess}
                />
              </DialogContent>
            </Dialog>
          </FooterBarEnd>
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
  isFetchingNextPage,
  revisionRequestIdByProposalId,
}: ProposalsProps & {
  revisionRequestIdByProposalId?: Map<string, string>;
}) => {
  const { user } = useUser();
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
    <ProposalMasonry loadingMore={isFetchingNextPage}>
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

        const aside = showMenu ? (
          <ProposalCardMenu
            proposal={proposal}
            canManage={canManageProposals}
          />
        ) : undefined;

        // Only pass `actions` when something will actually render — otherwise
        // the card draws a separator + empty row. Like/Follow render nothing
        // for non-interacting (anonymous) users, so gate that branch.
        const actions = hasRevisionRequest ? (
          <ProposalCardReviseAction editHref={reviseHref} />
        ) : isDraft || isEditable ? (
          <ProposalCardOwnerActions proposal={proposal} editHref={editHref} />
        ) : userCanInteract(user) ? (
          <ProposalCardActions proposal={proposal} />
        ) : undefined;

        return (
          <ProposalCardView
            key={proposal.id}
            proposal={proposal}
            href={viewHref}
            aside={aside}
            actions={actions}
            showMetrics={!isDraft}
            revisionRequested={hasRevisionRequest}
            className={isDraft ? 'bg-muted' : undefined}
          />
        );
      })}
    </ProposalMasonry>
  );
};
