'use client';

import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import {
  type DevelopSource,
  type DevelopedProposal,
  type ProposalReviewAggregates,
  RECOMMENDATION_OPTION,
  type RecommendationValue,
  isVotingEligible,
  nextCursor,
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
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { StatusDot, type StatusDotIntent } from '@op/sense/StatusDot';
import { Table, TableCell, TableRowHeader } from '@op/sense/Table';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import {
  type MouseEventHandler,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
} from 'react';
import { LuCheck, LuLeaf, LuPencil } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { decisionProposalDevelopHref } from '../proposalHrefs';
import {
  useProposalReviewAggregates,
  useReportProposalsForReviewDecoration,
} from '../proposalReviewDecoration';
import {
  type DevelopSourceScope,
  getDevelopSourcesInput,
  isSourceAdvancing,
} from './developSources';
import { getHttpStatus, isDevelopLockedError } from './getHttpStatus';
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
  const sourcesInput = getDevelopSourcesInput(query);
  // Without a category the input equals `getDevelopSourcesInput`, so readers
  // of that input share these pages.
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listDevelopSources.useSuspenseInfiniteQuery(
      query.categoryId
        ? { ...sourcesInput, categoryIds: [query.categoryId] }
        : sourcesInput,
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

export function useDevelopSourcesMeta() {
  return useDevelopSourcesContext().meta;
}

export function useDevelopSourcesState() {
  return useDevelopSourcesContext().state;
}

export function useDevelopSourceTitle(source: DevelopSource) {
  const t = useTranslations('decisions.proposals');
  return source.profile.name || t('untitledProposal');
}

export function DevelopSourcesTable({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <Table
      aria-label={t('sourcesTableLabel')}
      className={cn(
        className,
        '[&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0',
      )}
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

/** A source's title, as a link to where its row leads. */
export function DevelopSourceTitleLink({
  title,
  href,
  onClick,
}: {
  title: string;
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-base font-strong text-foreground hover:underline"
    >
      <bdi>{title}</bdi>
    </Link>
  );
}

/**
 * The source's title as the way into its entry: a link to the entry's develop
 * editor, or, while it has none the caller may read, a control that prepares one.
 */
export function DevelopSourceEntryTitle({ source }: { source: DevelopSource }) {
  const t = useTranslations('decisions.develop');
  const { actions, meta } = useDevelopSourcesContext();
  const title = useDevelopSourceTitle(source);
  const entry = getAdvancingEntry(source) ?? source.developedProposals[0];

  if (entry) {
    return (
      <DevelopSourceTitleLink
        title={title}
        href={decisionProposalDevelopHref({
          decisionSlug: meta.decisionSlug,
          profileId: entry.profileId,
        })}
      />
    );
  }

  return (
    <Button
      variant="link"
      size="inline"
      aria-label={t('prepareEntryLabel', { title })}
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

/** The actions or the decision of a source, side by side at the row's end. */
export function DevelopSourceActionsCell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <TableCell className="py-4 text-end">
      <div className="flex items-center justify-end gap-2">{children}</div>
    </TableCell>
  );
}

/** Creates an entry of this phase from a source that has none yet. */
export function DevelopSourcePrepareEntryButton({
  source,
  disabled,
}: {
  source: DevelopSource;
  disabled: boolean;
}) {
  const t = useTranslations('decisions.develop');
  const { state, actions } = useDevelopSourcesContext();
  const title = useDevelopSourceTitle(source);

  return (
    <Button
      variant="outline"
      aria-label={t('prepareEntryLabel', { title })}
      disabled={disabled}
      loading={state.preparingSourceId === source.id}
      onClick={() => actions.prepare(source)}
    >
      <LuPencil aria-hidden data-icon="inline-start" />
      {t('prepareEntryAction')}
    </Button>
  );
}

/** Opens the entry already developed from a source, draft or submitted. */
export function DevelopSourceEditEntryLink({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <ButtonLink
      variant="outline"
      href={href}
      aria-label={t('editEntryLabel', { title })}
    >
      <LuPencil aria-hidden data-icon="inline-start" />
      {t('editEntryAction')}
    </ButtonLink>
  );
}

/** Submits a source's draft entry, or un-advances it once submitted. */
export function DevelopSourceAdvanceEntryButton({
  entry,
  title,
  disabled,
}: {
  entry: DevelopedProposal;
  title: string;
  disabled: boolean;
}) {
  const t = useTranslations('decisions.develop');

  // No invalidation: the submit and the unsubmit publish on the decision's
  // proposals channel, which this list subscribes to.
  const submitEntry = trpc.decision.submitDevelopedProposal.useMutation({
    onError: (error) => {
      logger.error('Failed to advance a develop entry', { error });
      if (isDevelopLockedError(error)) {
        toast.error(t('developLockedError'));
      } else if (getHttpStatus(error) === 400) {
        // A 400 is the server's form validation: the entry is incomplete.
        toast.error(t('advanceEntryIncompleteError', { title }));
      } else {
        toast.error(t('advanceEntryError'));
      }
    },
  });
  const unsubmitEntry = trpc.decision.unsubmitDevelopedProposal.useMutation({
    onError: (error) => {
      logger.error('Failed to un-advance a develop entry', { error });
      toast.error(
        isDevelopLockedError(error)
          ? t('developLockedError')
          : t.rich('unadvanceEntryError', {
              title,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            }),
      );
    },
  });

  const isDraft = entry.status === ProposalStatus.DRAFT;
  const advanced = !isDraft;
  const actionable = isDraft || entry.status === ProposalStatus.SUBMITTED;

  return (
    <Button
      variant="outline"
      aria-pressed={advanced}
      loading={submitEntry.isPending || unsubmitEntry.isPending}
      disabled={disabled || !actionable}
      className={advanced ? 'border-primary bg-accent text-primary' : undefined}
      aria-label={
        advanced
          ? t('advancedEntryLabel', { title })
          : t('advanceEntryLabel', { title })
      }
      onClick={() =>
        isDraft
          ? submitEntry.mutate({ proposalId: entry.id })
          : unsubmitEntry.mutate({ proposalId: entry.id })
      }
    >
      {advanced ? <LuCheck aria-hidden data-icon="inline-start" /> : null}
      {advanced ? t('advancedEntryAction') : t('advanceEntryAction')}
    </Button>
  );
}

/** Whether a source's entry is advancing, once the caller confirmed their work. */
export function DevelopSourceDecisionBadge({
  source,
}: {
  source: DevelopSource;
}) {
  const t = useTranslations('decisions.develop');

  return isSourceAdvancing(source) ? (
    <StatusBadge variant="success" icon={false}>
      {t('entryAdvancingStatus')}
    </StatusBadge>
  ) : (
    <StatusBadge variant="inactive" icon={false}>
      {t('entryNotAdvancedStatus')}
    </StatusBadge>
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
