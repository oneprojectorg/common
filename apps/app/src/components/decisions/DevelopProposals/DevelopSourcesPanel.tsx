'use client';

import { trpc } from '@op/api/client';
import {
  type InstancePhaseData,
  type ProcessInstance,
  ProposalStatus,
} from '@op/api/encoders';
import {
  type DevelopSource,
  type DevelopedProposal,
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
import { StatusBadge } from '@op/sense/StatusBadge';
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
import {
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useMemo,
  useTransition,
} from 'react';
import { LuCheck, LuLeaf, LuPencil } from 'react-icons/lu';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';
import {
  ProposalReviewDecorationProvider,
  useProposalReviewAggregates,
  useReportProposalsForReviewDecoration,
} from '../proposalReviewDecoration';
import {
  type DevelopSourceScope,
  getDevelopSourceScope,
  getDevelopSourcesInput,
  isSourceAdvancing,
} from './developSources';
import { getHttpStatus } from './getHttpStatus';

interface DevelopSourcesPanelProps {
  instance: ProcessInstance;
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
}

interface SourcesTableProps {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
  /** Show the overall-recommendation column: the caller may read the reviews. */
  showRecommendations: boolean;
  decisionSlug: string;
}

const RECOMMENDATION_INTENT: Record<RecommendationValue, StatusDotIntent> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
};

/**
 * The Proposals tab of the develop screen: the previous phase's proposals
 * (the sources), each with its reviewers' overall recommendations. A source's
 * title opens it in the proposal sheet. A source with no entry yet shows
 * Prepare, which creates an entry of this phase from it; a source with an
 * entry shows Edit, which opens the first entry, and Advance, which submits
 * that entry while it is a draft and un-advances it once submitted. An admin
 * sees every source; anyone else sees the sources assigned to them.
 *
 * The list comes page by page from the API in its own order (newest first);
 * nothing is sorted or filtered here.
 */
export function DevelopSourcesPanel(props: DevelopSourcesPanelProps) {
  return (
    <SourcesPanelShell
      {...props}
      renderTable={(tableProps) => <EditableSourcesTable {...tableProps} />}
    />
  );
}

/**
 * The Proposals tab for a caller who may not develop now (they confirmed
 * their work): each source shows whether it is advancing instead of the
 * develop actions. A source's title opens the develop view: its entry
 * read-only, or the source beside the note that it has no entry yet.
 */
export function DevelopSourcesReadOnlyPanel(props: DevelopSourcesPanelProps) {
  return (
    <SourcesPanelShell
      {...props}
      renderTable={(tableProps) => <ReadOnlySourcesTable {...tableProps} />}
    />
  );
}

/**
 * The Proposals tab for a reviewer who may not develop: the sources assigned
 * to them, each with the state of its entry. A source with an entry shows
 * Edit, which opens the entry, where its co-authors edit it; a source with no
 * entry shows no action, as only a developer prepares one.
 */
export function DevelopSourcesCoauthorPanel(props: DevelopSourcesPanelProps) {
  return (
    <SourcesPanelShell
      {...props}
      renderTable={(tableProps) => <CoauthorSourcesTable {...tableProps} />}
    />
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

/** The scope, the empty state and the review decoration both variants share. */
function SourcesPanelShell({
  instance,
  sourcePhase,
  decisionSlug,
  renderTable,
}: DevelopSourcesPanelProps & {
  renderTable: (props: SourcesTableProps) => ReactNode;
}) {
  const t = useTranslations('decisions.develop');
  const scope = getDevelopSourceScope(instance);

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
      {renderTable({
        processInstanceId: instance.id,
        sourcePhaseId: sourcePhase.phaseId,
        scope,
        showRecommendations: canReadReviews,
        decisionSlug,
      })}
    </ProposalReviewDecorationProvider>
  );
}

function EditableSourcesTable(props: SourcesTableProps) {
  const { processInstanceId, decisionSlug } = props;
  const t = useTranslations('decisions');
  const router = useRouter();
  const openInSheet = useOpenProposalInSheet();
  const [isNavigating, startNavigating] = useTransition();
  const sourcesPage = useDevelopSourcesPage(props);

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
      toast.error(
        isDevelopLockedError(error)
          ? t('develop.developLockedError')
          : t('develop.prepareEntryError'),
      );
    },
  });

  const isPreparing = createEntry.isPending || isNavigating;
  const preparingSourceId = isPreparing
    ? (createEntry.variables?.sourceProposalIds[0] ?? null)
    : null;

  const prepare = (source: DevelopSource) =>
    createEntry.mutate({
      processInstanceId,
      sourceProposalIds: [source.id],
      // The server prefills the entry from the source's document.
      proposalData: {},
    });

  return (
    <SourcesTable
      {...props}
      sourcesPage={sourcesPage}
      renderTitle={(source, title) => (
        <SourceTitleLink
          title={title}
          href={decisionProposalHref({
            decisionSlug,
            profileId: source.profileId,
          })}
          onClick={openInSheet(source.profileId)}
        />
      )}
      renderActions={(source, title) => {
        // One entry per source for now: Edit and Advance act on the oldest
        // one.
        const developedEntry = source.developedProposals[0];

        return developedEntry ? (
          <EntryActions>
            <EditEntryLink
              title={title}
              href={decisionProposalDevelopHref({
                decisionSlug,
                profileId: developedEntry.profileId,
              })}
            />
            <AdvanceEntryButton
              entry={developedEntry}
              title={title}
              disabled={isPreparing}
            />
          </EntryActions>
        ) : (
          <PrepareEntryButton
            title={title}
            disabled={isPreparing}
            loading={preparingSourceId === source.id}
            onPrepare={() => prepare(source)}
          />
        );
      }}
    />
  );
}

function ReadOnlySourcesTable(props: SourcesTableProps) {
  const { decisionSlug } = props;
  const sourcesPage = useDevelopSourcesPage(props);

  return (
    <SourcesTable
      {...props}
      sourcesPage={sourcesPage}
      renderTitle={(source, title) => (
        <SourceTitleLink
          title={title}
          href={decisionProposalDevelopHref({
            decisionSlug,
            // The source's own develop view says it has no entry yet.
            profileId:
              source.developedProposals[0]?.profileId ?? source.profileId,
          })}
        />
      )}
      renderActions={(source) => (
        <EntryActions>
          <SourceDecisionBadge advancing={isSourceAdvancing(source)} />
        </EntryActions>
      )}
    />
  );
}

function CoauthorSourcesTable(props: SourcesTableProps) {
  const { decisionSlug } = props;
  const openInSheet = useOpenProposalInSheet();
  const sourcesPage = useDevelopSourcesPage(props);

  return (
    <SourcesTable
      {...props}
      sourcesPage={sourcesPage}
      renderTitle={(source, title) => (
        <SourceTitleLink
          title={title}
          href={decisionProposalHref({
            decisionSlug,
            profileId: source.profileId,
          })}
          onClick={openInSheet(source.profileId)}
        />
      )}
      renderActions={(source, title) => {
        const developedEntry = source.developedProposals[0];

        if (!developedEntry) {
          return (
            <EntryActions>
              <NoEntryBadge />
            </EntryActions>
          );
        }

        return (
          <EntryActions>
            <SourceDecisionBadge advancing={isSourceAdvancing(source)} />
            <EditEntryLink
              title={title}
              href={decisionProposalDevelopHref({
                decisionSlug,
                profileId: developedEntry.profileId,
              })}
            />
          </EntryActions>
        );
      }}
    />
  );
}

/** One page of sources at a time, with the next page loaded on scroll. */
function useDevelopSourcesPage({
  processInstanceId,
  sourcePhaseId,
  scope,
}: SourcesTableProps) {
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listDevelopSources.useSuspenseInfiniteQuery(
      getDevelopSourcesInput({ processInstanceId, sourcePhaseId, scope }),
      { getNextPageParam: nextCursor },
    );

  const sources = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );
  useReportProposalsForReviewDecoration(sources);

  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const { ref: nextPageRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
    });

  return {
    sources,
    total: data.pages[0]?.total ?? 0,
    nextPageRef,
    shouldShowTrigger,
    isFetchingNextPage,
  };
}

function SourcesTable({
  scope,
  showRecommendations,
  sourcesPage,
  renderTitle,
  renderActions,
}: SourcesTableProps & {
  sourcesPage: ReturnType<typeof useDevelopSourcesPage>;
  renderTitle: (source: DevelopSource, title: string) => ReactNode;
  renderActions: (source: DevelopSource, title: string) => ReactNode;
}) {
  const t = useTranslations('decisions');
  const { sources, total } = sourcesPage;

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
                        {renderTitle(source, title)}
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
                      {renderActions(source, title)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {sourcesPage.shouldShowTrigger ? (
            <div
              ref={sourcesPage.nextPageRef}
              aria-hidden
              className="flex flex-col"
            >
              {sourcesPage.isFetchingNextPage
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

/** Creates an entry of this phase from a source that has none yet. */
function PrepareEntryButton({
  title,
  disabled,
  loading,
  onPrepare,
}: {
  title: string;
  disabled: boolean;
  loading: boolean;
  onPrepare: () => void;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <Button
      variant="outline"
      aria-label={t('prepareEntryLabel', { title })}
      disabled={disabled}
      loading={loading}
      onClick={onPrepare}
    >
      <LuPencil aria-hidden data-icon="inline-start" />
      {t('prepareEntryAction')}
    </Button>
  );
}

/** Opens the entry already developed from a source, draft or submitted. */
function EditEntryLink({ title, href }: { title: string; href: string }) {
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

/** A source's title, as a link to where its row leads. */
function SourceTitleLink({
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

/** Whether a source's entry is advancing. */
function SourceDecisionBadge({ advancing }: { advancing: boolean }) {
  const t = useTranslations('decisions.develop');

  return advancing ? (
    <StatusBadge variant="success" icon={false}>
      {t('entryAdvancingStatus')}
    </StatusBadge>
  ) : (
    <StatusBadge variant="inactive" icon={false}>
      {t('entryNotAdvancedStatus')}
    </StatusBadge>
  );
}

function NoEntryBadge() {
  const t = useTranslations('decisions.develop');

  return (
    <StatusBadge variant="inactive" icon={false}>
      {t('noEntryStatus')}
    </StatusBadge>
  );
}

/** The actions or the decision of a source, side by side at the row's end. */
function EntryActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

/** Submits a source's draft entry, or un-advances it once submitted. */
function AdvanceEntryButton({
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
      const status = getHttpStatus(error);
      // A 400 is the server's form validation: the entry is incomplete.
      toast.error(
        status === 409
          ? t('developLockedError')
          : status === 400
            ? t('advanceEntryIncompleteError', { title })
            : t('advanceEntryError'),
      );
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

/** The server refuses a caller who confirmed their work with a 409. */
function isDevelopLockedError(error: unknown) {
  return getHttpStatus(error) === 409;
}
