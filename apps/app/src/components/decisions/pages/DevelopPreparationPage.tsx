'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { type ProcessInstance, ProposalFilter } from '@op/api/encoders';
import { type Proposal, nextCursor } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@op/sense/Empty';
import { ProposalCard } from '@op/sense/ProposalCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Suspense, useCallback, useState, useTransition } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { DecisionActionBar } from '../DecisionActionBar';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { MemberParticipationFacePile } from '../MemberParticipationFacePile';
import { useProposalCardData } from '../ProposalCard';
import { ProposalListSkeletonGrid } from '../ProposalListSkeleton';
import { ProposalMasonry } from '../ProposalMasonry';
import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { ProposalsListHeader } from '../ProposalsFilterBar';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { getPendingSelectionSourcePhase } from '../pendingSelection';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import { proposalHref } from '../proposalHrefs';
import { DevelopPageShell } from './DevelopPageShell';

interface PreparationProposalsProps {
  instanceId: string;
  sourcePhaseId: string;
  slug: string;
  decisionSlug?: string;
  filter: ProposalFilter;
  onFilterChange: (filter: ProposalFilter) => void;
}

/**
 * What a reader without develop access sees while a develop phase is current
 * and its inbound selection is pending: the previous phase's proposals, the
 * ones the develop screens use as sources, read-only.
 */
export function DevelopPreparationPage({
  instance,
  slug,
  decisionSlug,
}: {
  instance: ProcessInstance;
  slug: string;
  decisionSlug?: string;
}) {
  const t = useTranslations('decisions');
  const translation = useDecisionTranslation();
  const [filter, setFilter] = useState<ProposalFilter>(ProposalFilter.ALL);
  const [, startTransition] = useTransition();

  const phases = instance.instanceData.phases ?? [];
  const currentPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const sourcePhase = getPendingSelectionSourcePhase({
    phases,
    currentPhaseId: instance.currentStateId,
    selectionsAreConfirmed: instance.selectionsAreConfirmed,
  });
  const phaseAdditionalInfo =
    translation?.additionalInfo ?? currentPhase?.additionalInfo;

  // A transition keeps the shown list while the next filter loads.
  const handleFilterChange = (next: ProposalFilter) => {
    startTransition(() => setFilter(next));
  };

  return (
    <DevelopPageShell
      title={t('develop.preparationHeading')}
      description={t('develop.preparationDescription')}
      heroActions={
        <>
          {sourcePhase ? (
            <APIErrorBoundary fallbacks={{ default: () => null }}>
              <Suspense fallback={null}>
                <SourcePhaseSubmitters
                  instanceId={instance.id}
                  sourcePhaseId={sourcePhase.phaseId}
                />
              </Suspense>
            </APIErrorBoundary>
          ) : null}
          <DecisionActionBar
            instanceId={instance.id}
            description={phaseAdditionalInfo}
            label={t('aboutPhaseHeading')}
            markup={!!translation?.additionalInfo}
          />
        </>
      }
    >
      {sourcePhase ? (
        <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
          <Suspense fallback={<PreparationProposalsSkeleton />}>
            <PreparationProposals
              instanceId={instance.id}
              sourcePhaseId={sourcePhase.phaseId}
              slug={slug}
              decisionSlug={decisionSlug}
              filter={filter}
              onFilterChange={handleFilterChange}
            />
          </Suspense>
        </APIErrorBoundary>
      ) : (
        <NoPreparationProposals />
      )}
    </DevelopPageShell>
  );
}

function SourcePhaseSubmitters({
  instanceId,
  sourcePhaseId,
}: {
  instanceId: string;
  sourcePhaseId: string;
}) {
  const [{ items, total }] =
    trpc.decision.listProposalSubmitters.useSuspenseQuery({
      processInstanceId: instanceId,
      phaseId: sourcePhaseId,
    });

  return <MemberParticipationFacePile submitters={items} total={total} />;
}

function PreparationProposals({
  instanceId,
  sourcePhaseId,
  slug,
  decisionSlug,
  filter,
  onFilterChange,
}: PreparationProposalsProps) {
  const t = useTranslations('decisions');
  const { user } = useUser();
  const currentProfileId = user?.currentProfile?.id;

  const [paginatedData, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: instanceId,
        phaseId: sourcePhaseId,
        submittedByProfileId:
          filter === ProposalFilter.MY_PROPOSALS ? currentProfileId : undefined,
        dir: 'desc',
        limit: PROPOSALS_PAGE_LIMIT,
      },
      { getNextPageParam: nextCursor },
    );
  const [unfilteredData] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    phaseId: sourcePhaseId,
    dir: 'desc',
    limit: 1,
  });

  const stableFetchNextPage = useCallback(() => {
    void fetchNextPage();
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

  const proposals = paginatedData.pages.flatMap((page) => page.items);
  const total = paginatedData.pages[0]?.total ?? 0;
  const filterItems = [
    { value: ProposalFilter.ALL, label: t('proposals.allProposalsOption') },
    {
      value: ProposalFilter.MY_PROPOSALS,
      label: t('proposals.myProposalsOption'),
    },
  ];

  const handleValueChange = (value: string | null) => {
    if (value === ProposalFilter.ALL || value === ProposalFilter.MY_PROPOSALS) {
      onFilterChange(value);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <ProposalsListHeader count={total} total={unfilteredData.total} />
        {currentProfileId ? (
          <Select
            items={filterItems}
            value={filter}
            onValueChange={handleValueChange}
          >
            <SelectTrigger aria-label={t('proposals.filterProposalsLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {proposals.length === 0 ? (
        <NoPreparationProposals />
      ) : (
        <ProposalMasonry loadingMore={isFetchingNextPage}>
          {proposals.map((proposal) => (
            <PreparationProposalCard
              key={proposal.id}
              proposal={proposal}
              instanceId={instanceId}
              slug={slug}
              decisionSlug={decisionSlug}
            />
          ))}
        </ProposalMasonry>
      )}
      {shouldShowTrigger ? (
        <div ref={ref} className="h-px" aria-hidden />
      ) : null}
    </div>
  );
}

function PreparationProposalCard({
  proposal,
  instanceId,
  slug,
  decisionSlug,
}: {
  proposal: Proposal;
  instanceId: string;
  slug: string;
  decisionSlug?: string;
}) {
  const t = useTranslations('decisions');
  const openInSheet = useOpenProposalInSheet();
  const { titleText, displayCategories, authors, description } =
    useProposalCardData({ proposal });

  return (
    <ProposalCard
      title={titleText}
      href={proposalHref({
        profileId: proposal.profileId,
        decisionSlug,
        slug,
        instanceId,
      })}
      onTitleClick={openInSheet(proposal.profileId)}
      linkComponent={Link}
      tags={displayCategories.length > 0 ? displayCategories : undefined}
      authors={authors}
      description={description}
      status={
        <StatusBadge variant="in-progress" icon={false}>
          {t('develop.underConsiderationStatus')}
        </StatusBadge>
      }
      data-testid="proposal-card"
    />
  );
}

function NoPreparationProposals() {
  const t = useTranslations('decisions');

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('develop.noPreparationProposalsTitle')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

function PreparationProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <ProposalListSkeletonGrid />
    </div>
  );
}
