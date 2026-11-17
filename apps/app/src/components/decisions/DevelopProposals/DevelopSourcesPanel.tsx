'use client';

import { trpc } from '@op/api/client';
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import {
  type ListDevelopSourcesInput,
  type Proposal,
  type ProposalReviewAggregates,
  RECOMMENDATION_OPTION,
  type RecommendationValue,
  isReviewPhase,
  nextCursor,
  resolveReviewSettings,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusDot, type StatusDotIntent } from '@op/sense/StatusDot';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { toast } from '@op/sense/Toast';
import { useCallback, useMemo, useTransition } from 'react';
import { LuLeaf, LuPencil } from 'react-icons/lu';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';
import {
  ProposalReviewDecorationProvider,
  useProposalReviewAggregates,
  useReportProposalsForReviewDecoration,
} from '../proposalReviewDecoration';

type DevelopSourceScope = ListDevelopSourcesInput['scope'];

const RECOMMENDATION_INTENT: Record<RecommendationValue, StatusDotIntent> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
};

/**
 * The Proposals tab of the develop screen: the previous phase's proposals
 * (the sources), each with its reviewers' overall recommendations and a
 * Prepare action that creates an entry of this phase from it. An admin sees
 * every source; anyone else sees the sources assigned to them.
 *
 * The list comes page by page from the API in its own order (newest first);
 * nothing is sorted or filtered here.
 */
export function DevelopSourcesPanel({
  instance,
  sourcePhase,
  decisionSlug,
}: {
  instance: ProcessInstance;
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const scope: DevelopSourceScope = instance.access?.admin ? 'all' : 'assigned';

  if (!sourcePhase) {
    return (
      <div className="flex flex-col gap-10">
        <div className="flex min-h-11 items-center">
          <Header2 className="text-title font-normal">
            {t('sourcesCount', { count: 0 })}
          </Header2>
        </div>
        <NoSourcesEmpty scope={scope} />
      </div>
    );
  }

  // Mirrors the server's `canReadPhaseReviews`, which gates the aggregates
  // read: admins always, reviewers when the source phase's reviews are open.
  const canReadReviews =
    isReviewPhase(sourcePhase) &&
    (Boolean(instance.access?.admin) ||
      (Boolean(instance.access?.review) &&
        resolveReviewSettings(instance.instanceData, sourcePhase.phaseId)
          .openReviews));

  return (
    <ProposalReviewDecorationProvider
      processInstanceId={instance.id}
      decisionSlug={decisionSlug}
      phaseId={sourcePhase.phaseId}
      enabled={canReadReviews}
      canOpenReviews={false}
    >
      <DevelopSourcesTable
        processInstanceId={instance.id}
        sourcePhaseId={sourcePhase.phaseId}
        scope={scope}
        showRecommendations={canReadReviews}
        decisionSlug={decisionSlug}
      />
    </ProposalReviewDecorationProvider>
  );
}

export function DevelopSourcesTableSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <Skeleton className="h-7 w-40" />
      <div className="flex flex-col">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border-b py-4"
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="hidden h-4 w-48 md:block" />
            <Skeleton className="h-11 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DevelopSourcesTable({
  processInstanceId,
  sourcePhaseId,
  scope,
  showRecommendations,
  decisionSlug,
}: {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
  /** Show the overall-recommendation column: the caller may read the reviews. */
  showRecommendations: boolean;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');
  const router = useRouter();
  const openInSheet = useOpenProposalInSheet();
  const [isNavigating, startNavigating] = useTransition();

  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listDevelopSources.useSuspenseInfiniteQuery(
      {
        processInstanceId,
        phaseIds: [sourcePhaseId],
        scope,
        limit: PROPOSALS_PAGE_LIMIT,
      },
      { getNextPageParam: nextCursor },
    );

  const sources = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );
  const total = data.pages[0]?.total ?? 0;
  useReportProposalsForReviewDecoration(sources);

  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const { ref: nextPageRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
    });

  const createEntry = trpc.decision.createDevelopedProposal.useMutation({
    onSuccess: (entry) => {
      startNavigating(() => {
        router.push(
          decisionProposalDevelopHref({
            decisionSlug,
            profileId: entry.profileId,
          }),
        );
      });
    },
    onError: (error) => {
      logger.error('Failed to prepare a develop entry', { error });
      toast.error(t('develop.prepareEntryError'));
    },
  });

  const isPreparing = createEntry.isPending || isNavigating;
  const preparingSourceId = isPreparing
    ? (createEntry.variables?.sourceProposalIds[0] ?? null)
    : null;

  const prepare = (source: Proposal) =>
    createEntry.mutate({
      processInstanceId,
      sourceProposalIds: [source.id],
      // The server prefills the entry from the source; a category sent here
      // wins over the mapped one.
      proposalData: { category: source.proposalData.category },
    });

  return (
    <div className="flex flex-col gap-10">
      {/* The Entries tab's search row's height, so the count holds still
          across tabs. */}
      <div aria-live="polite" className="flex min-h-11 items-center">
        <Header2 className="text-title font-normal">
          {t('develop.sourcesCount', { count: total })}
        </Header2>
      </div>

      {sources.length === 0 ? (
        <NoSourcesEmpty scope={scope} />
      ) : (
        <div className="flex flex-col">
          <Table
            aria-label={t('develop.sourcesTableLabel')}
            className="min-w-3xl [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
          >
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('develop.nameColumn')}</TableHead>
                {showRecommendations ? (
                  <TableHead scope="col">
                    {t('review.overallRecommendationLabel')}
                  </TableHead>
                ) : null}
                <TableHead scope="col" className="text-end">
                  <span className="sr-only">{t('develop.actionsColumn')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => {
                const title =
                  source.profile.name || t('proposals.untitledProposal');
                const submitterName = source.submittedBy
                  ? source.submittedBy.name || source.submittedBy.slug
                  : null;

                return (
                  <TableRow key={source.id}>
                    <TableRowHeader className="py-4">
                      <div className="flex flex-col items-start gap-0.5">
                        <Link
                          href={decisionProposalHref({
                            decisionSlug,
                            profileId: source.profileId,
                          })}
                          onClick={openInSheet(source.profileId)}
                          className="text-base font-strong text-foreground hover:underline"
                        >
                          <bdi>{title}</bdi>
                        </Link>
                        {submitterName ? (
                          <span className="text-sm text-muted-foreground">
                            <bdi>{submitterName}</bdi>
                          </span>
                        ) : null}
                      </div>
                    </TableRowHeader>
                    {showRecommendations ? (
                      <TableCell className="py-4">
                        <SourceRecommendations proposalId={source.id} />
                      </TableCell>
                    ) : null}
                    <TableCell className="py-4 text-end">
                      <Button
                        variant="outline"
                        aria-label={t('develop.prepareEntryLabel', { title })}
                        disabled={isPreparing}
                        loading={preparingSourceId === source.id}
                        onClick={() => prepare(source)}
                      >
                        <LuPencil aria-hidden data-icon="inline-start" />
                        {t('develop.prepareEntryAction')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {shouldShowTrigger ? (
            <div ref={nextPageRef} aria-hidden className="flex flex-col">
              {isFetchingNextPage
                ? Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4 border-b py-4"
                    >
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-11 w-28" />
                    </div>
                  ))
                : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * The reviewers' overall recommendations for one source, as counts of Yes,
 * Maybe and No. The aggregates load after the row, a page at a time.
 */
function SourceRecommendations({ proposalId }: { proposalId: string }) {
  const review = useProposalReviewAggregates(proposalId);

  if (review.status === 'loading') {
    return <Skeleton className="h-5 w-48" />;
  }
  if (review.status === 'unavailable') {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <RecommendationCounts
      counts={review.aggregates.overallRecommendationCount}
    />
  );
}

function RecommendationCounts({
  counts,
}: {
  counts: ProposalReviewAggregates['overallRecommendationCount'];
}) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-4 whitespace-nowrap">
      {Object.values(RECOMMENDATION_OPTION).map((option) => (
        <StatusDot
          key={option.value}
          intent={RECOMMENDATION_INTENT[option.value]}
          className="text-base text-foreground"
        >
          {counts[option.value] ?? 0} {t(option.label)}
        </StatusDot>
      ))}
    </div>
  );
}

/** What the Proposals tab shows when the previous phase offers no sources. */
function NoSourcesEmpty({ scope }: { scope: DevelopSourceScope }) {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>{t('noSourcesTitle')}</EmptyTitle>
        <EmptyDescription>
          {scope === 'assigned'
            ? t('noAssignedSourcesDescription')
            : t('noSourcesDescription')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
