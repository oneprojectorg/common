'use client';

import { trpc } from '@op/api/client';
import {
  type DevelopSource,
  type ListDevelopSourcesInput,
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
import { LuLeaf, LuPencil } from 'react-icons/lu';

import { type TranslateFn, Link, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';
import { useReportProposalsForReviewDecoration } from '../proposalReviewDecoration';
import { NoSourcesEmpty, SourceRecommendations } from './DevelopSourcesPanel';
import { usePrepareDevelopEntry } from './usePrepareDevelopEntry';

interface DevelopSourcesQuery {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: ListDevelopSourcesInput['scope'];
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
  scope: ListDevelopSourcesInput['scope'];
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
        processInstanceId: query.processInstanceId,
        phaseIds: [query.sourcePhaseId],
        scope: query.scope,
        categoryIds: query.categoryId ? [query.categoryId] : undefined,
        limit: PROPOSALS_PAGE_LIMIT,
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
      className="min-w-5xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
    >
      {children}
    </Table>
  );
}

export function DevelopSourceNameCell({ source }: { source: DevelopSource }) {
  const t = useTranslations('decisions');
  const { decisionSlug } = useDevelopSourcesContext().meta;
  const openInSheet = useOpenProposalInSheet();
  const submitterName = source.submittedBy
    ? source.submittedBy.name || source.submittedBy.slug
    : null;

  return (
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
          <bdi>{getSourceTitle({ source, t })}</bdi>
        </Link>
        {submitterName ? (
          <span className="text-sm text-muted-foreground">
            <bdi>{submitterName}</bdi>
          </span>
        ) : null}
      </div>
    </TableRowHeader>
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
    <TableCell className="py-4">
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

export function DevelopSourceActionCell({ source }: { source: DevelopSource }) {
  const t = useTranslations('decisions');
  const { state, actions, meta } = useDevelopSourcesContext();
  const title = getSourceTitle({ source, t });
  const entry = getAdvancingEntry(source) ?? source.developedProposals[0];

  return (
    <TableCell className="py-4 text-end">
      {entry ? (
        <ButtonLink
          variant="outline"
          href={decisionProposalDevelopHref({
            decisionSlug: meta.decisionSlug,
            profileId: entry.profileId,
          })}
          aria-label={t('develop.editEntryLabel', { title })}
        >
          <LuPencil aria-hidden data-icon="inline-start" />
          {t('develop.editEntryAction')}
        </ButtonLink>
      ) : (
        <Button
          variant="outline"
          aria-label={t('develop.prepareEntryLabel', { title })}
          disabled={state.isPreparing}
          loading={state.preparingSourceId === source.id}
          onClick={() => actions.prepare(source)}
        >
          <LuPencil aria-hidden data-icon="inline-start" />
          {t('develop.prepareEntryAction')}
        </Button>
      )}
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

export function DevelopSourceActionCellSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <TableCell className={cn('py-4', className)}>
      <Skeleton className="ms-auto h-11 w-28 max-w-full" />
    </TableCell>
  );
}

function getAdvancingEntry(source: DevelopSource) {
  return source.developedProposals.find((entry) =>
    isVotingEligible(entry.status),
  );
}

function getSourceTitle({
  source,
  t,
}: {
  source: DevelopSource;
  t: TranslateFn<'decisions'>;
}) {
  return source.profile.name || t('proposals.untitledProposal');
}

function useDevelopSourcesContext() {
  const context = useContext(DevelopSourcesContext);
  if (!context) {
    throw new Error('Develop sources parts need a DevelopSourcesProvider');
  }
  return context;
}
