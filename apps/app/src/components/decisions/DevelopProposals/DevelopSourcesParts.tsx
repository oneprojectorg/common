'use client';

import { trpc } from '@op/api/client';
import {
  type DevelopSource,
  type ProposalReviewAggregates,
  RECOMMENDATION_OPTION,
  type RecommendationValue,
  isVotingEligible,
  nextCursor,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { StatusDot, type StatusDotIntent } from '@op/sense/StatusDot';
import { Table, TableCell, TableRowHeader } from '@op/sense/Table';
import { cn } from '@op/sense/lib/utils';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
} from 'react';
import { LuLeaf } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { decisionProposalDevelopHref } from '../proposalHrefs';
import {
  useProposalReviewAggregates,
  useReportProposalsForReviewDecoration,
} from '../proposalReviewDecoration';
import {
  type DevelopSourceScope,
  getDevelopSourcesInput,
} from './developSources';
import { usePrepareDevelopEntry } from './usePrepareDevelopEntry';

interface DevelopSourcesQuery {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
  categoryId: string | undefined;
}

interface DevelopSourcesContextValue {
  state: {
    isPreparing: boolean;
    preparingSourceId: string | null;
  };
  actions: {
    prepare: (source: DevelopSource) => void;
  };
  meta: {
    query: DevelopSourcesQuery;
    isNarrowed: boolean;
    decisionSlug: string;
  };
}

const DevelopSourcesContext = createContext<DevelopSourcesContextValue | null>(
  null,
);

const RECOMMENDATION_INTENT: Record<RecommendationValue, StatusDotIntent> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
};

export function DevelopSourcesProvider({
  processInstanceId,
  sourcePhaseId,
  scope,
  categoryId,
  decisionSlug,
  children,
}: {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
  categoryId?: string;
  decisionSlug: string;
  children: ReactNode;
}) {
  // Deferred so the current rows stay on screen while the next ones load.
  const deferredCategoryId = useDeferredValue(categoryId);
  const { prepare, isPreparing, preparingSourceId } = usePrepareDevelopEntry({
    processInstanceId,
    decisionSlug,
  });

  const value: DevelopSourcesContextValue = {
    state: { isPreparing, preparingSourceId },
    actions: { prepare },
    meta: {
      query: {
        processInstanceId,
        sourcePhaseId,
        scope,
        categoryId: deferredCategoryId,
      },
      isNarrowed: Boolean(deferredCategoryId),
      decisionSlug,
    },
  };

  return (
    <DevelopSourcesContext.Provider value={value}>
      {children}
    </DevelopSourcesContext.Provider>
  );
}

export function useDevelopSources() {
  const { query } = useDevelopSourcesContext().meta;
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listDevelopSources.useSuspenseInfiniteQuery(
      {
        ...getDevelopSourcesInput(query),
        categoryIds: query.categoryId ? [query.categoryId] : undefined,
      },
      { getNextPageParam: nextCursor },
    );

  // The React Compiler is not enabled in this app.
  const sources = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );
  useReportProposalsForReviewDecoration(sources);

  return {
    sources,
    total: data.pages[0]?.total ?? 0,
    /** The category the rows were read for, which lags the filter. */
    categoryId: query.categoryId,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}

export function DevelopSourcesTable({ children }: { children: ReactNode }) {
  const t = useTranslations('decisions.develop');

  return (
    <Table
      aria-label={t('sourcesTableLabel')}
      className="min-w-4xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
    >
      {children}
    </Table>
  );
}

/** The source's submitter under a title control the variant passes in. */
export function DevelopSourceNameCell({
  source,
  children,
}: {
  source: DevelopSource;
  children: ReactNode;
}) {
  const submitterName = source.submittedBy
    ? source.submittedBy.name || source.submittedBy.slug
    : null;

  return (
    <TableRowHeader className="py-4">
      <div className="flex flex-col items-start gap-0.5">
        {children}
        {submitterName ? (
          <span className="text-sm text-muted-foreground">
            <bdi>{submitterName}</bdi>
          </span>
        ) : null}
      </div>
    </TableRowHeader>
  );
}

/**
 * The source's title as the way into its entry: a link to the entry's develop
 * editor, or, while it has none the caller may read, a control that prepares one.
 */
export function DevelopSourceEntryTitle({ source }: { source: DevelopSource }) {
  const t = useTranslations('decisions');
  const { actions, meta } = useDevelopSourcesContext();
  const title = source.profile.name || t('proposals.untitledProposal');
  const entry = getAdvancingEntry(source) ?? source.developedProposals[0];

  if (entry) {
    return (
      <Link
        href={decisionProposalDevelopHref({
          decisionSlug: meta.decisionSlug,
          profileId: entry.profileId,
        })}
        className="text-base font-strong text-foreground hover:underline"
      >
        <bdi>{title}</bdi>
      </Link>
    );
  }

  return (
    <Button
      variant="link"
      size="inline"
      aria-label={t('develop.prepareEntryLabel', { title })}
      onClick={() => actions.prepare(source)}
      className="justify-start text-start whitespace-normal text-foreground"
    >
      <bdi>{title}</bdi>
    </Button>
  );
}

export function DevelopSourceRecommendationsCell({
  source,
}: {
  source: DevelopSource;
}) {
  return (
    <TableCell className="py-4">
      <SourceRecommendations proposalId={source.id} />
    </TableCell>
  );
}

// Advancing once an entry developed from the source is submitted and still in
// the running; the API returns only the entries the caller may read.
export function DevelopSourceDecisionCell({
  source,
}: {
  source: DevelopSource;
}) {
  const t = useTranslations('decisions.develop');
  const isAdvancing = Boolean(getAdvancingEntry(source));

  return (
    <TableCell className="py-4 text-end">
      <StatusBadge
        variant={isAdvancing ? 'success' : 'in-progress'}
        icon={false}
      >
        {isAdvancing
          ? t('sourceAdvancingStatus')
          : t('sourceUnderConsiderationStatus')}
      </StatusBadge>
    </TableCell>
  );
}

export function DevelopSourcesEmpty({
  narrowedDescription,
}: {
  narrowedDescription: string;
}) {
  const t = useTranslations();
  const { isNarrowed, query } = useDevelopSourcesContext().meta;

  if (!isNarrowed) {
    return <NoSourcesEmpty scope={query.scope} />;
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>{t('No results')}</EmptyTitle>
        <EmptyDescription>{narrowedDescription}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** What the Proposals tab shows when the previous phase offers no sources. */
export function NoSourcesEmpty({ scope }: { scope: DevelopSourceScope }) {
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

/**
 * The reviewers' overall recommendations for one source, as counts of Yes,
 * Maybe and No. The aggregates load after the row, a page at a time.
 */
export function SourceRecommendations({ proposalId }: { proposalId: string }) {
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

export function DevelopSourcesNextPage({ children }: { children: ReactNode }) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDevelopSources();

  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const { ref, shouldShowTrigger } = useInfiniteScroll<HTMLDivElement>(
    loadNextPage,
    { hasNextPage, isFetchingNextPage },
  );

  return shouldShowTrigger ? (
    <div ref={ref} aria-hidden className="flex flex-col">
      {isFetchingNextPage ? children : null}
    </div>
  ) : null;
}

// Each line box matches the real title and submitter line heights.
export function DevelopSourceNameCellSkeleton() {
  return (
    <TableCell className="py-4">
      <div className="flex flex-col items-start gap-0.5">
        <span className="flex h-6 w-full items-center">
          <Skeleton className="h-4 w-56 max-w-full" />
        </span>
        <span className="flex h-5 w-full items-center">
          <Skeleton className="h-3.5 w-28 max-w-full" />
        </span>
      </div>
    </TableCell>
  );
}

export function DevelopSourceRecommendationsCellSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <TableCell className={cn('py-4', className)}>
      <Skeleton className="h-5 w-48 max-w-full" />
    </TableCell>
  );
}

export function DevelopSourceDecisionCellSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <TableCell className={cn('py-4', className)}>
      <Skeleton className="ms-auto h-9 w-24" />
    </TableCell>
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

function getAdvancingEntry(source: DevelopSource) {
  return source.developedProposals.find((entry) =>
    isVotingEligible(entry.status),
  );
}

function useDevelopSourcesContext() {
  const context = useContext(DevelopSourcesContext);
  if (!context) {
    throw new Error('Develop sources parts need a DevelopSourcesProvider');
  }
  return context;
}
