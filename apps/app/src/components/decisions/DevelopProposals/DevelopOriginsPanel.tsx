'use client';

import { trpc } from '@op/api/client';
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import {
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
  type ProposalRoute,
  proposalEditHref,
  proposalHref,
} from '../proposalHrefs';
import {
  ProposalReviewDecorationProvider,
  useProposalReviewAggregates,
  useReportProposalsForReviewDecoration,
} from '../proposalReviewDecoration';

type Route = Omit<ProposalRoute, 'profileId'>;

const RECOMMENDATION_INTENT: Record<RecommendationValue, StatusDotIntent> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
};

/**
 * The Proposals tab of the develop screen: the previous phase's proposals
 * (the origins), each with its reviewers' overall recommendations and a
 * Prepare action that creates an entry of this phase from it.
 *
 * The list comes page by page from the API in its own order (newest first);
 * nothing is sorted or filtered here.
 */
export function DevelopOriginsPanel({
  instance,
  originPhase,
  route,
}: {
  instance: ProcessInstance;
  originPhase: InstancePhaseData | null;
  route: Route;
}) {
  const t = useTranslations('decisions.develop');

  if (!originPhase) {
    return (
      <div className="flex flex-col gap-10">
        <div className="flex min-h-11 items-center">
          <Header2 className="text-title font-normal">
            {t('originsCount', { count: 0 })}
          </Header2>
        </div>
        <NoOriginsEmpty />
      </div>
    );
  }

  // Mirrors the server's `canReadPhaseReviews`, which gates the aggregates
  // read: admins always, reviewers when the origin phase's reviews are open.
  const canReadReviews =
    isReviewPhase(originPhase) &&
    (Boolean(instance.access?.admin) ||
      (Boolean(instance.access?.review) &&
        resolveReviewSettings(instance.instanceData ?? {}, originPhase.phaseId)
          .openReviews));

  return (
    <ProposalReviewDecorationProvider
      processInstanceId={instance.id}
      decisionSlug={route.decisionSlug ?? route.slug}
      phaseId={originPhase.phaseId}
      enabled={canReadReviews}
      canOpenReviews={false}
    >
      <DevelopOriginsTable
        processInstanceId={instance.id}
        originPhaseId={originPhase.phaseId}
        showRecommendations={canReadReviews}
        route={route}
      />
    </ProposalReviewDecorationProvider>
  );
}

export function DevelopOriginsTableSkeleton() {
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

function DevelopOriginsTable({
  processInstanceId,
  originPhaseId,
  showRecommendations,
  route,
}: {
  processInstanceId: string;
  originPhaseId: string;
  /** Show the overall-recommendation column: the caller may read the reviews. */
  showRecommendations: boolean;
  route: Route;
}) {
  const t = useTranslations('decisions');
  const router = useRouter();
  const openInSheet = useOpenProposalInSheet();
  const [isNavigating, startNavigating] = useTransition();

  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId,
        phaseId: originPhaseId,
        limit: PROPOSALS_PAGE_LIMIT,
      },
      { getNextPageParam: nextCursor },
    );

  const origins = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );
  const total = data.pages[0]?.total ?? 0;
  useReportProposalsForReviewDecoration(origins);

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
        router.push(proposalEditHref({ ...route, profileId: entry.profileId }));
      });
    },
    onError: (error) => {
      logger.error('Failed to prepare a develop entry', { error });
      toast.error(t('develop.prepareEntryError'));
    },
  });

  const isPreparing = createEntry.isPending || isNavigating;
  const preparingOriginId = isPreparing
    ? (createEntry.variables?.sourceProposalIds[0] ?? null)
    : null;

  const prepare = (origin: Proposal) =>
    createEntry.mutate({
      processInstanceId,
      sourceProposalIds: [origin.id],
      // A suggested draft: the entry starts from the origin's title and
      // category, and the editor takes it from there.
      proposalData: {
        title: origin.profile.name,
        category: origin.proposalData.category,
      },
    });

  return (
    <div className="flex flex-col gap-10">
      {/* The Entries tab's search row's height, so the count holds still
          across tabs. */}
      <div aria-live="polite" className="flex min-h-11 items-center">
        <Header2 className="text-title font-normal">
          {t('develop.originsCount', { count: total })}
        </Header2>
      </div>

      {origins.length === 0 ? (
        <NoOriginsEmpty />
      ) : (
        <div className="flex flex-col">
          <Table
            aria-label={t('develop.originsTableLabel')}
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
              {origins.map((origin) => {
                const title =
                  origin.profile.name || t('proposals.untitledProposal');
                const submitterName = origin.submittedBy
                  ? origin.submittedBy.name || origin.submittedBy.slug
                  : null;

                return (
                  <TableRow key={origin.id}>
                    <TableRowHeader className="py-4 whitespace-normal">
                      <div className="flex flex-col items-start gap-0.5">
                        <Link
                          href={proposalHref({
                            ...route,
                            profileId: origin.profileId,
                          })}
                          onClick={openInSheet(origin.profileId)}
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
                        <OriginRecommendations proposalId={origin.id} />
                      </TableCell>
                    ) : null}
                    <TableCell className="py-4 text-end">
                      <Button
                        variant="outline"
                        aria-label={t('develop.prepareEntryLabel', { title })}
                        disabled={isPreparing}
                        loading={preparingOriginId === origin.id}
                        onClick={() => prepare(origin)}
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
 * The reviewers' overall recommendations for one origin, as counts of Yes,
 * Maybe and No. The aggregates load after the row, a page at a time.
 */
function OriginRecommendations({ proposalId }: { proposalId: string }) {
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

/** What the Proposals tab shows when the previous phase offers no origins. */
function NoOriginsEmpty() {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>{t('noOriginsTitle')}</EmptyTitle>
        <EmptyDescription>{t('noOriginsDescription')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
