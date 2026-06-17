'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type DecisionAccess,
  type InstancePhaseData,
  ProposalFilter,
  ProposalStatus,
} from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTranslation,
  ProposalReviewRequestState,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isVotingEligible,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { Button, ButtonLink } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { FooterBar } from '@op/ui/FooterBar';
import { Header3 } from '@op/ui/Header';
import { Link } from '@op/ui/Link';
import { Modal } from '@op/ui/Modal';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LuArrowDownToLine, LuLeaf } from 'react-icons/lu';

import { usePathname, useRouter, useTranslations } from '@/lib/i18n';

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
  ProposalCardReviseAction,
} from './ProposalCard';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import { ResponsiveSelect } from './ResponsiveSelect';
import { TranslateBanner } from './TranslateBanner';
import { VoteSubmissionModal } from './VoteSubmissionModal';
import { VoteSuccessModal } from './VoteSuccessModal';
import { VotingProposalCard } from './VotingProposalCard';
import { useProposalExport } from './useProposalExport';
import {
  useProposalFilterItems,
  useProposalFilterState,
} from './useProposalFilters';

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

interface ProposalsProps {
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
}

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
  const t = useTranslations();

  const numSelected = selectedProposalIds.length;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

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
    setShowSuccessModal(true); // Show success modal
    utils.decision.getVotingStatus.invalidate({
      processInstanceId: instanceId,
    });
  };

  if (!proposals || proposals.length === 0) {
    if (proposalsHidden && !hasFilter) {
      return <HiddenProposalsEmptyState />;
    }
    return <NoProposalsFound hasFilter={hasFilter} />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      </div>

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
  revisionRequestIdByProposalId,
}: ProposalsProps & {
  revisionRequestIdByProposalId?: Map<string, string>;
}) => {
  const canManageProposals = permissions?.admin ?? false;
  if (!proposals || proposals.length === 0) {
    if (proposalsHidden && !hasFilter) {
      return <HiddenProposalsEmptyState />;
    }
    return <NoProposalsFound hasFilter={hasFilter} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {proposals.map((proposal) => {
        const isDraft = proposal.status === ProposalStatus.DRAFT;
        const isEditable = Boolean(proposal.isEditable);
        const showMenu = canManageProposals;
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
    </div>
  );
};

const Proposals = ({
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

export interface ProposalsListProps {
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
  /** Current phase; capability flags are derived from `rules`. */
  currentPhase?: InstancePhaseData;
  /** When true, new proposals are hidden by default in the current phase. */
  proposalsHidden?: boolean;
}

// Matches the prior single-page render, so smaller decisions never hit the sentinel.
const PROPOSALS_PAGE_LIMIT = 50;

type ProposalQueryParams = {
  processInstanceId: string;
  categoryId?: string;
  submittedByProfileId?: string;
  votedByProfileId?: string;
  status?: ProposalStatus;
  dir: 'asc' | 'desc';
  limit: number;
  phase?: 'results';
};

type ProposalsLoaderRenderProps = {
  allProposals: Proposal[];
  /** Full server-side proposal count, independent of how many pages are loaded. */
  total: number;
  isFetchingNextPage: boolean;
  shouldShowTrigger: boolean;
  infiniteScrollRef: RefObject<HTMLDivElement | null>;
};

const useProposalsLoaderRenderProps = (
  allProposals: Proposal[],
  total: number,
  {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  }: {
    fetchNextPage: () => unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
  },
): ProposalsLoaderRenderProps => {
  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref, shouldShowTrigger } = useInfiniteScroll<HTMLDivElement>(
    stableFetchNextPage,
    {
      hasNextPage,
      isFetchingNextPage,
      threshold: 0.1,
      rootMargin: '50px',
    },
  );

  return {
    allProposals,
    total,
    isFetchingNextPage,
    shouldShowTrigger,
    infiniteScrollRef: ref,
  };
};

const CurrentPhaseProposalsLoader = ({
  queryParams,
  children,
}: {
  queryParams: ProposalQueryParams;
  children: (data: ProposalsLoaderRenderProps) => React.ReactNode;
}) => {
  const [paginatedData, query] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(queryParams, {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      staleTime: 30 * 1000,
    });

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.proposals),
    [paginatedData.pages],
  );
  const total = paginatedData.pages[0]?.total ?? 0;

  return children(useProposalsLoaderRenderProps(allProposals, total, query));
};

const ResultsPhaseProposalsLoader = ({
  queryParams,
  children,
}: {
  queryParams: ProposalQueryParams;
  children: (data: ProposalsLoaderRenderProps) => React.ReactNode;
}) => {
  const [paginatedData, query] =
    trpc.decision.listAllProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: queryParams.processInstanceId,
        dir: queryParams.dir,
        limit: queryParams.limit,
        categoryId: queryParams.categoryId,
        status: queryParams.status,
        submittedByProfileId: queryParams.submittedByProfileId,
        votedByProfileId: queryParams.votedByProfileId,
      },
      {
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
        staleTime: 30 * 1000,
      },
    );

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.items),
    [paginatedData.pages],
  );
  const total = paginatedData.pages[0]?.total ?? 0;

  return children(useProposalsLoaderRenderProps(allProposals, total, query));
};

export const ProposalsList = (props: ProposalsListProps) => {
  const { instanceId, phase, initialFilter } = props;

  const { user } = useUser();
  const currentProfileId = user?.currentProfile?.id;

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });
  const hasVoted = voteStatus?.hasVoted || false;

  const { proposalFilter, setProposalFilter } = useProposalFilterState({
    hasVoted,
    initialFilter,
  });

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

  const queryParams = useMemo<ProposalQueryParams>(() => {
    const params: ProposalQueryParams = {
      processInstanceId: instanceId,
      dir: sortOrder === 'newest' ? 'desc' : 'asc',
      limit: PROPOSALS_PAGE_LIMIT,
      phase,
    };

    if (selectedCategory !== 'all-categories') {
      params.categoryId = selectedCategory;
    }

    // Filter in SQL so pagination and the total count stay accurate per filter.
    if (proposalFilter === ProposalFilter.MY_PROPOSALS && currentProfileId) {
      params.submittedByProfileId = currentProfileId;
    } else if (proposalFilter === ProposalFilter.SHORTLISTED) {
      params.status = ProposalStatus.APPROVED;
    } else if (
      proposalFilter === ProposalFilter.MY_BALLOT &&
      currentProfileId
    ) {
      params.votedByProfileId = currentProfileId;
    }

    return params;
  }, [
    instanceId,
    selectedCategory,
    sortOrder,
    phase,
    proposalFilter,
    currentProfileId,
  ]);

  const renderContent = (data: ProposalsLoaderRenderProps) => (
    <ProposalsListContent
      {...props}
      {...data}
      proposalFilter={proposalFilter}
      setProposalFilter={setProposalFilter}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      sortOrder={sortOrder}
      setSortOrder={setSortOrder}
    />
  );

  if (phase === 'results') {
    return (
      <ResultsPhaseProposalsLoader queryParams={queryParams}>
        {renderContent}
      </ResultsPhaseProposalsLoader>
    );
  }

  return (
    <CurrentPhaseProposalsLoader queryParams={queryParams}>
      {renderContent}
    </CurrentPhaseProposalsLoader>
  );
};

type ProposalsListContentProps = ProposalsListProps &
  ProposalsLoaderRenderProps & {
    proposalFilter: ProposalFilter;
    setProposalFilter: (filter: ProposalFilter) => void;
    selectedCategory: string;
    setSelectedCategory: (value: string) => void;
    sortOrder: string;
    setSortOrder: (value: string) => void;
  };

// fallow-ignore-next-line complexity
const useProposalsTranslation = ({
  allProposals,
  decisionProfileId,
}: {
  allProposals: Proposal[];
  decisionProfileId?: string | null;
}) => {
  const t = useTranslations();
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
    const profileIds = allProposals.map((p) => p.profileId);
    if (profileIds.length) {
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
  const sourceLanguageName = translationState
    ? (languageNames.of(
        translationState.sourceLocale.toLowerCase().split('-')[0] ?? '',
      ) ?? '')
    : '';
  const targetLanguageName = languageNames.of(locale) ?? locale;

  const showBanner =
    !!supportedLocale &&
    supportedLocale !== 'en' &&
    !bannerDismissed &&
    !translationState;

  return {
    translationState,
    showBanner,
    sourceLanguageName,
    targetLanguageName,
    handleTranslate,
    handleViewOriginal,
    dismissBanner: () => setBannerDismissed(true),
    isTranslating: translateBatchMutation.isPending,
  };
};

// useTranslations needs literal keys, so map each filter to its label here.
const useProposalFilterLabel = (filter: ProposalFilter) => {
  const t = useTranslations();
  switch (filter) {
    case ProposalFilter.MY_BALLOT:
      return t('My ballot');
    case ProposalFilter.MY_PROPOSALS:
      return t('My proposals');
    case ProposalFilter.SHORTLISTED:
      return t('Shortlisted proposals');
    default:
      return t('All proposals');
  }
};

const ProposalsListHeader = ({
  hideFilters,
  proposalFilter,
  count,
}: {
  hideFilters: boolean;
  proposalFilter: ProposalFilter;
  count: number;
}) => {
  const t = useTranslations();
  const label = useProposalFilterLabel(proposalFilter);

  return (
    <span className="font-serif text-title-base text-neutral-black">
      {hideFilters ? (
        t('My proposals')
      ) : (
        <>
          {label} <Bullet /> {count}
        </>
      )}
    </span>
  );
};

// fallow-ignore-next-line complexity
const ProposalsFilterBar = ({
  hasVoted,
  currentProfileId,
  proposalFilter,
  setProposalFilter,
  categories,
  selectedCategory,
  onSelectCategory,
  sortOrder,
  onSelectSort,
  canManageProposals,
  isExporting,
  isDownloadReady,
  downloadUrl,
  downloadFileName,
  onExport,
}: {
  hasVoted: boolean;
  currentProfileId: string | undefined;
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  sortOrder: string;
  onSelectSort: (sort: string) => void;
  canManageProposals: boolean;
  isExporting: boolean;
  isDownloadReady: boolean;
  downloadUrl?: string | null;
  downloadFileName?: string | null;
  onExport: () => void;
}) => {
  const t = useTranslations();
  const filterItems = useProposalFilterItems({ hasVoted, currentProfileId });

  return (
    <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
      <ResponsiveSelect
        selectedKey={proposalFilter}
        onSelectionChange={(key) => {
          if (key === ProposalFilter.MY_PROPOSALS && !currentProfileId) {
            return;
          }
          setProposalFilter(key);
        }}
        aria-label={t('Filter proposals')}
        items={filterItems}
      />
      <ResponsiveSelect
        selectedKey={selectedCategory}
        onSelectionChange={onSelectCategory}
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
        onSelectionChange={onSelectSort}
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
            download={downloadFileName ?? undefined}
            color="secondary"
            size="small"
          >
            <LuArrowDownToLine className="size-4" />
            {t('Click to download')}
          </ButtonLink>
        ) : (
          <Button
            onPress={onExport}
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
  );
};

// fallow-ignore-next-line complexity
const ProposalsListContent = ({
  slug,
  instanceId,
  decisionSlug,
  decisionProfileId,
  permissions,
  currentPhase,
  proposalsHidden,
  allProposals,
  total,
  isFetchingNextPage,
  shouldShowTrigger,
  infiniteScrollRef,
  proposalFilter,
  setProposalFilter,
  selectedCategory,
  setSelectedCategory,
  sortOrder,
  setSortOrder,
}: ProposalsListContentProps) => {
  const isReviewPhase = currentPhase?.rules?.proposals?.review === true;
  const isVotingPhase = currentPhase?.rules?.voting?.submit === true;
  const t = useTranslations();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const currentProfileId = user?.currentProfile?.id;
  const [[categoriesData, voteStatus]] = trpc.useSuspenseQueries((t) => [
    t.decision.getCategories({
      processInstanceId: instanceId,
    }),
    t.decision.getVotingStatus({
      processInstanceId: instanceId,
    }),
  ]);

  const categories = categoriesData.categories;

  const hasVoted = voteStatus?.hasVoted || false;
  const selectedProposalIds =
    voteStatus?.voteSubmission?.selectedProposalIds || [];

  const {
    startExport,
    isExporting,
    isDownloadReady,
    downloadUrl,
    downloadFileName,
  } = useProposalExport();

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

  const canManageProposals = permissions?.admin ?? false;

  const { data: revisionRequestsData } =
    trpc.decision.listProposalsRevisionRequests.useQuery(
      { states: [ProposalReviewRequestState.REQUESTED] },
      { enabled: !!isReviewPhase },
    );

  const revisionRequestIdByProposalId = new Map<string, string>(
    revisionRequestsData?.revisionRequests.map(
      ({ proposal, revisionRequest }) => [proposal.id, revisionRequest.id],
    ),
  );

  const translation = useProposalsTranslation({
    allProposals,
    decisionProfileId,
  });

  const isFirstFilterSync = useRef(true);
  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false;
      return;
    }
    updateURLParams({ filter: proposalFilter });
  }, [proposalFilter]);

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

  const hideFilters = !!proposalsHidden && !canManageProposals;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProposalsListHeader
            hideFilters={hideFilters}
            proposalFilter={proposalFilter}
            // Filtering happens in SQL, so `total` is the accurate full count
            // for whichever filter is active.
            count={total}
          />
        </div>
        {!hideFilters && (
          <ProposalsFilterBar
            hasVoted={hasVoted}
            currentProfileId={currentProfileId}
            proposalFilter={proposalFilter}
            setProposalFilter={setProposalFilter}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(category) => {
              setSelectedCategory(category);
              updateURLParams({ category });
            }}
            sortOrder={sortOrder}
            onSelectSort={(sort) => {
              setSortOrder(sort);
              updateURLParams({ sort });
            }}
            canManageProposals={canManageProposals}
            isExporting={isExporting}
            isDownloadReady={isDownloadReady}
            downloadUrl={downloadUrl}
            downloadFileName={downloadFileName}
            onExport={handleExport}
          />
        )}
      </div>

      {translation.translationState && (
        <p className="text-sm text-neutral-gray3">
          {t('Translated from {language}', {
            language: translation.sourceLanguageName,
          })}{' '}
          &middot;{' '}
          <Link
            onPress={translation.handleViewOriginal}
            className="text-sm font-semibold"
          >
            {t('View original')}
          </Link>
        </p>
      )}

      <ProposalTranslationProvider
        translations={translation.translationState?.translations ?? {}}
      >
        <Proposals
          proposals={allProposals}
          instanceId={instanceId}
          slug={slug}
          decisionSlug={decisionSlug}
          permissions={permissions}
          votedProposalIds={selectedProposalIds}
          hasFilter={selectedCategory !== 'all-categories'}
          isVotingPhase={isVotingPhase}
          proposalsHidden={proposalsHidden}
          revisionRequestIdByProposalId={revisionRequestIdByProposalId}
        />
      </ProposalTranslationProvider>

      {shouldShowTrigger && (
        <div
          ref={infiniteScrollRef}
          className="flex justify-center py-4"
          data-testid="proposals-infinite-scroll-sentinel"
        >
          {isFetchingNextPage ? <ProposalListSkeletonGrid /> : null}
        </div>
      )}

      {translation.showBanner && (
        <TranslateBanner
          onTranslate={translation.handleTranslate}
          onDismiss={translation.dismissBanner}
          isTranslating={translation.isTranslating}
          languageName={translation.targetLanguageName}
        />
      )}
    </div>
  );
};
