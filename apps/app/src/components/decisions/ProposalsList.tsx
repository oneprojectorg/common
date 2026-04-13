'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type DecisionAccess,
  ProposalFilter,
  ProposalStatus,
} from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@op/common/client';
import { Button, ButtonLink } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Link } from '@op/ui/Link';
import { Modal } from '@op/ui/Modal';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuArrowDownToLine, LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { useSetDecisionTranslation } from './DecisionTranslationContext';
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
} from './ProposalCard';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import { ResponsiveSelect } from './ResponsiveSelect';
import { TranslateBanner } from './TranslateBanner';
import { VoteSubmissionModal } from './VoteSubmissionModal';
import { VoteSuccessModal } from './VoteSuccessModal';
import { VotingProposalCard } from './VotingProposalCard';
import { VotingSubmitFooter } from './VotingSubmitFooter';
import { useProposalExport } from './useProposalExport';
import { useProposalFilters } from './useProposalFilters';

const ProposalCardSkeleton = () => {
  return (
    <Surface className="relative w-full min-w-80 space-y-3 p-4 pb-4">
      {/* Header with title and budget skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      {/* Author and category skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-1 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Description skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Footer with engagement skeleton */}
      <div className="flex flex-col justify-between gap-4">
        <div className="flex w-full items-center justify-between gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    </Surface>
  );
};

{
  /* Proposals Grid Skeleton */
}
export const ProposalListSkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <ProposalCardSkeleton key={index} />
    ))}
  </div>
);

export const ProposalListSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* Filters Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <ProposalListSkeletonGrid />
    </div>
  );
};

const NoProposalsFound = ({ hasFilter }: { hasFilter: boolean }) => {
  const t = useTranslations();
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

interface ProposalsProps {
  proposals?: Proposal[];
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  isLoading: boolean;
  permissions?: DecisionAccess | null;
  votedProposalIds?: string[];
  hasFilter: boolean;
}

const VotingProposalsList = ({
  proposals,
  instanceId,
  slug,
  permissions,
  votedProposalIds = [],
  hasFilter,
}: ProposalsProps) => {
  const canVote = permissions?.vote ?? false;
  const canManageProposals = permissions?.admin ?? false;
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const t = useTranslations();

  const numSelected = selectedProposalIds.length;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

  const utils = trpc.useUtils();

  // Determine voting state
  const hasVoted = voteStatus?.hasVoted || false;
  const isReadOnly = hasVoted;
  const maxVotesPerMember =
    voteStatus?.votingConfiguration?.maxVotesPerMember || 0;

  // Handle proposal selection
  const toggleProposal = (proposalId: string) => {
    setSelectedProposalIds((prev) => {
      const isSelected = prev.includes(proposalId);

      if (isSelected) {
        // Remove from selection
        return prev.filter((id) => id !== proposalId);
      } else {
        // Add to selection if under limit
        if (prev.length < maxVotesPerMember) {
          return [...prev, proposalId];
        }
        return prev;
      }
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
    setShowSuccessModal(true); // Show success modal
    utils.decision.getVotingStatus.invalidate({
      processInstanceId: instanceId,
    });
  };

  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound hasFilter={hasFilter} />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => {
          const isSelected = isProposalSelected(proposal.id);
          const isApproved = proposal.status === ProposalStatus.APPROVED;
          const isVotedFor = votedProposalIds.includes(proposal.id);
          const showCheckbox = !isReadOnly || isVotedFor;

          // Render VotingProposalCard for approved proposals, regular ProposalCard for others
          if (isApproved) {
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
                                isSelected={
                                  isReadOnly ? isVotedFor : isSelected
                                }
                                onChange={() => {
                                  toggleProposal(proposal.id);
                                }}
                                isDisabled={isReadOnly}
                                shape="circle"
                                borderColor="light"
                                // Override disabled icon color to keep checkmark white (using design token)
                                className="[&[data-disabled]_svg]:!text-white"
                                aria-label={
                                  isSelected
                                    ? 'Deselect proposal'
                                    : 'Select proposal'
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
                    href={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
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
                <div className="flex h-full flex-col justify-between gap-3 space-y-3">
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
                      href={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
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
      </div>

      <VotingSubmitFooter isVisible={canVote && !isReadOnly}>
        <div className="flex w-full items-center justify-between px-4 sm:max-w-6xl sm:px-8">
          <span className="text-neutral-black">
            <span className="text-primary-teal">{numSelected}</span> of{' '}
            {maxVotesPerMember}{' '}
            {maxVotesPerMember === 1 ? 'proposal' : 'proposals'} selected
          </span>

          <DialogTrigger>
            <Button isDisabled={numSelected === 0} variant="primary">
              {t('Submit my votes')}
            </Button>

            <Modal isDismissable>
              <Dialog className="h-full">
                <VoteSubmissionModal
                  selectedProposals={selectedProposals}
                  instanceId={instanceId}
                  maxVotes={maxVotesPerMember}
                  onSuccess={handleVoteSuccess}
                />
              </Dialog>
            </Modal>
          </DialogTrigger>
        </div>
      </VotingSubmitFooter>

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
}: ProposalsProps) => {
  const canManageProposals = permissions?.admin ?? false;
  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound hasFilter={hasFilter} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {proposals.map((proposal) => {
        const isDraft = proposal.status === ProposalStatus.DRAFT;
        const isEditable = Boolean(proposal.isEditable);
        const showMenu = canManageProposals;
        // Use new route structure if decisionSlug is provided, otherwise fallback to legacy route
        const editHref = decisionSlug
          ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`
          : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}/edit`;
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
                <ProposalCardMeta proposal={proposal} />
                <ProposalCardPreview proposal={proposal} />
              </ProposalCardContent>
            </div>
            <ProposalCardContent>
              <ProposalCardFooter>
                {isDraft ? (
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
    </div>
  );
};

const Proposals = (props: ProposalsProps) => {
  const { isLoading, instanceId } = props;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

  // Determine voting state from phase capability
  const isVotingEnabled = !!voteStatus?.votingConfiguration?.allowDecisions;

  if (isLoading) {
    return <ProposalListSkeletonGrid />;
  }

  if (isVotingEnabled) {
    return <VotingProposalsList {...props} />;
  }

  return <ViewProposalsList {...props} />;
};

export const ProposalsList = ({
  slug,
  instanceId,
  decisionSlug,
  decisionProfileId,
  permissions,
  initialFilter,
  phase,
}: {
  slug: string;
  instanceId: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Decision profile ID for translating the decision content */
  decisionProfileId?: string | null;
  /** Role-based capabilities for the current user. */
  permissions?: DecisionAccess | null;
  /** Override the default proposal filter */
  initialFilter?: ProposalFilter;
  /** When set to 'results', all proposals are returned as non-editable */
  phase?: 'results';
}) => {
  const t = useTranslations();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedCategory, setSelectedCategory] = useState(
    () =>
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('category')) ||
      'all-categories',
  );
  const [sortOrder, setSortOrder] = useState(
    () =>
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('sort')) ||
      'newest',
  );

  // Get current user's profile ID for "My Proposals" filter
  const currentProfileId = user.currentProfile?.id;
  const [[categoriesData, voteStatus]] = trpc.useSuspenseQueries((t) => [
    t.decision.getCategories({
      processInstanceId: instanceId,
    }),
    t.decision.getVotingStatus({
      processInstanceId: instanceId,
    }),
  ]);

  const categories = categoriesData.categories;

  // Determine if we're in ballot view (user has voted)
  const hasVoted = voteStatus?.hasVoted || false;
  const selectedProposalIds =
    voteStatus?.voteSubmission?.selectedProposalIds || [];

  // Export hook
  const {
    startExport,
    isExporting,
    isDownloadReady,
    downloadUrl,
    downloadFileName,
  } = useProposalExport();

  // Helper function to update URL params
  const updateURLParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all-categories' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  };

  // Build query parameters, ensuring consistent structure
  const queryParams = useMemo(() => {
    const params: {
      processInstanceId: string;
      categoryId?: string;
      submittedByProfileId?: string;
      status?: ProposalStatus;
      dir: 'asc' | 'desc';
      limit: number;
      phase?: 'results';
    } = {
      processInstanceId: instanceId,
      dir: sortOrder === 'newest' ? 'desc' : 'asc',
      limit: 50,
      phase,
    };

    // Only include categoryId if it's not "all-categories"
    if (selectedCategory !== 'all-categories') {
      params.categoryId = selectedCategory;
    }

    return params;
  }, [instanceId, selectedCategory, sortOrder, phase]);

  const { data: proposalsData, isLoading } =
    trpc.decision.listProposals.useQuery(queryParams);

  const { proposals: allProposals } = proposalsData ?? {};
  const canManageProposals = permissions?.admin ?? false;

  // --- Translation state ---
  const locale = useLocale();
  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [translationState, setTranslationState] = useState<{
    translations: Record<string, ProposalTranslation>;
    sourceLocale: string;
  } | null>(null);

  const setDecisionTranslation = useSetDecisionTranslation();

  const translateBatchMutation =
    trpc.translation.translateProposals.useMutation({
      onSuccess: (data) => {
        setTranslationState({
          translations: data.translations,
          sourceLocale: data.sourceLocale,
        });
      },
    });

  const translateDecisionMutation =
    trpc.translation.translateDecision.useMutation({
      onSuccess: (data) => {
        if (data.sourceLocale) {
          // Set translationState from decision result when no proposals were translated
          setTranslationState((prev) =>
            prev ? prev : { translations: {}, sourceLocale: data.sourceLocale },
          );
        }
        if (
          !data.headline &&
          !data.phaseDescription &&
          !data.additionalInfo &&
          !data.description &&
          data.phases.length === 0
        ) {
          return;
        }
        setDecisionTranslation({
          headline: data.headline,
          phaseDescription: data.phaseDescription,
          additionalInfo: data.additionalInfo,
          description: data.description,
          phases: data.phases,
        });
      },
      onError: () => {
        toast.error({ message: t('Failed to translate content') });
      },
    });

  const handleTranslate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }
    const profileIds = allProposals?.map((p) => p.profileId);
    if (profileIds?.length) {
      translateBatchMutation.mutate({
        profileIds,
        targetLocale: supportedLocale,
      });
    }
    if (decisionProfileId) {
      translateDecisionMutation.mutate({
        decisionProfileId,
        targetLocale: supportedLocale,
      });
    }
  }, [
    translateBatchMutation,
    translateDecisionMutation,
    allProposals,
    supportedLocale,
    decisionProfileId,
  ]);

  const handleViewOriginal = useCallback(() => {
    setTranslationState(null);
    setDecisionTranslation(null);
  }, [setDecisionTranslation]);

  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'language' }),
    [locale],
  );
  const getLanguageName = (langCode: string) =>
    languageNames.of(langCode) ?? langCode;

  const sourceLanguageName = translationState
    ? getLanguageName(
        translationState.sourceLocale.toLowerCase().split('-')[0] ?? '',
      )
    : '';
  const targetLanguageName = getLanguageName(locale);

  const showBanner =
    !!supportedLocale &&
    supportedLocale !== 'en' &&
    !bannerDismissed &&
    !translationState;

  // Use the custom hook for filtering proposals
  const {
    filteredProposals: proposals,
    proposalFilter,
    setProposalFilter,
  } = useProposalFilters({
    proposals: allProposals || [],
    currentProfileId,
    votedProposalIds: selectedProposalIds,
    hasVoted,
    initialFilter,
  });

  // Sync URL with filter changes (both manual and automatic), skipping initial render
  const isFirstFilterSync = useRef(true);
  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false;
      return;
    }
    updateURLParams({ filter: proposalFilter });
  }, [proposalFilter]);

  // Handle export
  const handleExport = () => {
    startExport(
      {
        processInstanceId: instanceId,
        categoryId:
          selectedCategory !== 'all-categories' ? selectedCategory : undefined,
        dir: sortOrder === 'newest' ? 'desc' : 'asc',
        proposalFilter,
      },
      'csv',
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-serif text-title-base text-neutral-black">
            {proposalFilter === ProposalFilter.MY_BALLOT
              ? t('My ballot')
              : proposalFilter === ProposalFilter.MY_PROPOSALS
                ? t('My proposals')
                : proposalFilter === ProposalFilter.SHORTLISTED
                  ? t('Shortlisted proposals')
                  : t('All proposals')}{' '}
            <Bullet /> {proposals?.length ?? 0}
          </span>
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <ResponsiveSelect
            selectedKey={proposalFilter}
            onSelectionChange={(key) => {
              // If selecting "My proposals" but no current profile, ignore
              if (key === ProposalFilter.MY_PROPOSALS && !currentProfileId) {
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
                isDisabled: !currentProfileId,
              },
              {
                id: ProposalFilter.SHORTLISTED,
                label: t('Shortlisted proposals'),
              },
              ...(hasVoted
                ? [
                    {
                      id: ProposalFilter.MY_BALLOT,
                      label: t('My ballot'),
                    },
                  ]
                : []),
            ]}
          />
          <ResponsiveSelect
            selectedKey={selectedCategory}
            onSelectionChange={(category) => {
              setSelectedCategory(category);
              updateURLParams({ category });
            }}
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
            onSelectionChange={(sort) => {
              setSortOrder(sort);
              updateURLParams({ sort });
            }}
            aria-label={t('Sort proposals')}
            className="min-w-32"
            items={[
              { id: 'newest', label: t('Newest First') },
              { id: 'oldest', label: t('Oldest First') },
            ]}
          />
          {canManageProposals ? (
            isDownloadReady && downloadUrl ? (
              <ButtonLink
                href={downloadUrl}
                download={downloadFileName}
                color="secondary"
                size="small"
              >
                <LuArrowDownToLine className="size-4" />
                {t('Click to download')}
              </ButtonLink>
            ) : (
              <Button
                onPress={handleExport}
                isDisabled={isExporting}
                color="secondary"
                size="small"
              >
                <LuArrowDownToLine className="size-4" />
                {isExporting ? t('Exporting...') : t('Export')}
              </Button>
            )
          ) : null}
        </div>
      </div>

      {/* Translation attribution */}
      {translationState && (
        <p className="text-sm text-neutral-gray3">
          {t('Translated from {language}', { language: sourceLanguageName })}{' '}
          &middot;{' '}
          <Link onPress={handleViewOriginal} className="text-sm font-semibold">
            {t('View original')}
          </Link>
        </p>
      )}

      <ProposalTranslationProvider
        translations={translationState?.translations ?? {}}
      >
        <Proposals
          isLoading={isLoading}
          proposals={proposals}
          instanceId={instanceId}
          slug={slug}
          decisionSlug={decisionSlug}
          permissions={permissions}
          votedProposalIds={selectedProposalIds}
          hasFilter={selectedCategory !== 'all-categories'}
        />
      </ProposalTranslationProvider>

      {showBanner && (
        <TranslateBanner
          onTranslate={handleTranslate}
          onDismiss={() => setBannerDismissed(true)}
          isTranslating={translateBatchMutation.isPending}
          languageName={targetLanguageName}
        />
      )}
    </div>
  );
};
