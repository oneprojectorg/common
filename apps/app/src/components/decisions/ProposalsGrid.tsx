'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import {
  type DecisionAccess,
  ProposalStatus,
  Visibility,
} from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  isVotingEligible,
  normalizeProposalCategories,
} from '@op/common/client';
import { match } from '@op/core';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { Dialog, DialogContent, DialogTrigger } from '@op/sense/Dialog';
import { Empty, EmptyHeader, EmptyMedia } from '@op/sense/Empty';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Header3 } from '@op/sense/Header';
import { ProposalCard as SenseProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge } from '@op/sense/StatusBadge';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { formatBudget } from './BudgetDisplay';
import {
  ProposalCardActions,
  ProposalCardContent,
  ProposalCardFooter,
  ProposalCardHeader,
  ProposalCardMenu,
  ProposalCardMeta,
  ProposalCardOwnerActions,
  ProposalCardPreview,
  ProposalCardReviseAction,
} from './ProposalCard';
import { ProposalMasonry } from './ProposalMasonry';
import { useCardTranslation } from './ProposalTranslationContext';
import { RevisionRequestChip } from './RevisionRequestChip';
import { VoteSubmissionModal } from './VoteSubmissionModal';
import { VoteSuccessModal } from './VoteSuccessModal';
import { VotingProposalCard } from './VotingProposalCard';
import {
  getProposalContentPreview,
  resolveProposalSystemFields,
} from './proposalContentUtils';
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

/**
 * Non-voting proposal card, rebuilt on the `@op/sense/ProposalCard` composite.
 * Maps the app's `Proposal` (title / budget / categories / author / preview /
 * status) into the composite's presentational props and passes the "…" menu
 * and footer actions through its `aside` / `actions` slots.
 */
const ProposalCardView = ({
  proposal,
  href,
  aside,
  actions,
  showMetrics = false,
  revisionRequested = false,
  className,
}: {
  proposal: Proposal;
  href?: string;
  aside?: ReactNode;
  actions?: ReactNode;
  showMetrics?: boolean;
  revisionRequested?: boolean;
  className?: string;
}) => {
  const t = useTranslations();
  const canLinkToProfile = useCanLinkToProfile();
  const cardTranslation = useCardTranslation(proposal.profileId);
  const { title, budget, category } = resolveProposalSystemFields(proposal);

  const titleText =
    cardTranslation?.title ??
    (title || proposal.profile.name || t('Untitled Proposal'));

  const budgetText = formatBudget(budget) ?? undefined;

  const displayCategories = cardTranslation?.category
    ? cardTranslation.category
    : normalizeProposalCategories(category);
  const tags =
    revisionRequested || displayCategories.length === 0
      ? undefined
      : displayCategories;

  // Match the old card: link the author to their profile only when linking is
  // allowed and the author isn't anonymous.
  const authorHref =
    proposal.submittedBy &&
    canLinkToProfile &&
    !proposal.submittedBy.isAnonymous
      ? `/profile/${proposal.submittedBy.slug}`
      : undefined;
  const authors = proposal.submittedBy
    ? [
        {
          name: proposal.submittedBy.name || proposal.submittedBy.slug || '',
          avatarSrc: proposal.submittedBy.avatarImage?.name
            ? (getPublicUrl(proposal.submittedBy.avatarImage.name) ?? undefined)
            : undefined,
          href: authorHref,
        },
      ]
    : undefined;

  const translatedPreview = cardTranslation?.preview;
  const previewText =
    translatedPreview === undefined
      ? (proposal.previewText ??
        getProposalContentPreview(
          proposal.documentContent,
          (proposal.proposalTemplate as ProposalTemplateSchema) ?? undefined,
        ))
      : undefined;
  const description = (translatedPreview ?? previewText) || undefined;

  const metrics = showMetrics
    ? {
        likes: proposal.likesCount || 0,
        bookmarks: proposal.followersCount || 0,
        comments: proposal.commentsCount || 0,
      }
    : undefined;

  return (
    <SenseProposalCard
      title={titleText}
      href={href}
      linkComponent={Link}
      className={className}
      headerBadge={
        revisionRequested ? undefined : (
          <ProposalStatusBadge proposal={proposal} />
        )
      }
      alert={revisionRequested ? <RevisionRequestChip /> : undefined}
      aside={aside}
      budget={budgetText}
      tags={tags}
      authors={authors}
      description={description}
      metrics={metrics}
      actions={actions}
    />
  );
};

/** Proposal status/visibility surfaced as the composite's `headerBadge`. */
const ProposalStatusBadge = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { status, visibility, isSelected, isFlagged } = proposal;

  // DRAFT wins over HIDDEN: a draft created in a hidden-by-default phase
  // should still read as "Draft" to its author, not "Hidden".
  if (status === ProposalStatus.DRAFT) {
    return <StatusBadge variant="inactive">{t('Draft')}</StatusBadge>;
  }

  // A flagged proposal is hidden from members pending a moderation verdict.
  if (isFlagged) {
    return <StatusBadge variant="alert">{t('Flagged')}</StatusBadge>;
  }

  if (visibility === Visibility.HIDDEN) {
    return <StatusBadge variant="warning">{t('Hidden')}</StatusBadge>;
  }

  // "Selected" is driven by results selection, not the editable `status`.
  if (isSelected) {
    return <StatusBadge variant="success">{t('Selected')}</StatusBadge>;
  }

  return match(status, {
    [ProposalStatus.APPROVED]: (
      <StatusBadge variant="success">{t('Shortlisted')}</StatusBadge>
    ),
    [ProposalStatus.REJECTED]: (
      <StatusBadge variant="inactive">{t('Not shortlisted')}</StatusBadge>
    ),
    _: null,
  });
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
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {t('No other proposals')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {t('There are no proposals outside your review queue.')}
          </p>
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
        <p className="text-base text-neutral-charcoal">
          {t("You'll see your proposal here once you submit.")}
        </p>
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
                      )
                    }
                  />
                  <ProposalCardMeta withLink={false} proposal={proposal} />
                  <ProposalCardPreview proposal={proposal} />
                </ProposalCardContent>
                <ProposalCardFooter>
                  <ButtonLink
                    href={proposalHref}
                    variant="outline"
                    className="w-full"
                  >
                    {t('Read full proposal')}
                  </ButtonLink>
                </ProposalCardFooter>
              </VotingProposalCard>
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
          </FooterBarStart>
          <FooterBarCenter />
          <FooterBarEnd>
            <Dialog>
              <DialogTrigger
                render={
                  <Button disabled={numSelected === 0} variant="default">
                    {t('Submit my votes')}
                  </Button>
                }
              />
              <DialogContent className="h-full">
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
