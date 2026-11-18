'use client';

import { getHttpStatus } from '@/utils/getHttpStatus';
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
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { LuCheck, LuLeaf, LuPencil } from 'react-icons/lu';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { decisionProposalDevelopHref } from '../proposalHrefs';
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

interface DevelopSourcesPanelProps {
  instance: ProcessInstance;
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
}

interface SourcesTableProps {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
  showRecommendations: boolean;
  decisionSlug: string;
}

type PendingStatusChange = {
  entryId: string;
  toAdvanced: boolean;
};

const RECOMMENDATION_INTENT: Record<RecommendationValue, StatusDotIntent> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
};

/**
 * The Proposals tab of the develop screen: the previous phase's proposals
 * (the sources), each with its reviewers' overall recommendations. A source
 * with no entry yet shows Prepare, which creates an entry of this phase from
 * it; a source with an entry shows Edit, which opens the first entry, and
 * Advance, which submits that entry while it is a draft and un-advances it
 * once submitted. An admin sees every source; anyone else sees the
 * sources assigned to them.
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

export function DevelopSourcesReadOnlyPanel(props: DevelopSourcesPanelProps) {
  return (
    <SourcesPanelShell
      {...props}
      renderTable={(tableProps) => <ReadOnlySourcesTable {...tableProps} />}
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
  const [isNavigating, startNavigating] = useTransition();
  const sourcesPage = useDevelopSourcesPage(props);
  const { sources } = sourcesPage;

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

  // No invalidation: the submit and the unsubmit publish on the decision's
  // proposals channel, which this list subscribes to.
  const submitEntry = trpc.decision.submitDevelopedProposal.useMutation();
  const unsubmitEntry = trpc.decision.unsubmitDevelopedProposal.useMutation();

  // Held until the channel's refetch shows the entry's new status.
  const [pendingChange, setPendingChange] =
    useState<PendingStatusChange | null>(null);
  if (pendingChange) {
    const pendingEntry = sources
      .flatMap((source) => source.developedProposals)
      .find((entry) => entry.id === pendingChange.entryId);
    const targetStatus = pendingChange.toAdvanced
      ? ProposalStatus.SUBMITTED
      : ProposalStatus.DRAFT;
    if (!pendingEntry || pendingEntry.status === targetStatus) {
      setPendingChange(null);
    }
  }

  const changingEntryId = pendingChange?.entryId ?? null;
  const isBusy = isPreparing || pendingChange !== null;

  const advance = (entry: DevelopedProposal, title: string) => {
    setPendingChange({ entryId: entry.id, toAdvanced: true });
    submitEntry.mutate(
      { proposalId: entry.id },
      {
        onError: (error) => {
          setPendingChange(null);
          logger.error('Failed to advance a develop entry', { error });
          const status = getHttpStatus(error);
          // A 400 is the server's form validation: the entry is incomplete.
          toast.error(
            status === 409
              ? t('develop.developLockedError')
              : status === 400
                ? t('develop.advanceEntryIncompleteError', { title })
                : t('develop.advanceEntryError'),
          );
        },
      },
    );
  };

  const unadvance = (entry: DevelopedProposal, title: string) => {
    setPendingChange({ entryId: entry.id, toAdvanced: false });
    unsubmitEntry.mutate(
      { proposalId: entry.id },
      {
        onError: (error) => {
          setPendingChange(null);
          logger.error('Failed to un-advance a develop entry', { error });
          toast.error(
            isDevelopLockedError(error)
              ? t('develop.developLockedError')
              : t.rich('develop.unadvanceEntryError', {
                  title,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                }),
          );
        },
      },
    );
  };

  return (
    <SourcesTable
      {...props}
      sourcesPage={sourcesPage}
      renderActions={(source, title) => {
        // One entry per source for now: the actions use the oldest.
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
              title={title}
              status={developedEntry.status}
              disabled={isBusy}
              loading={changingEntryId === developedEntry.id}
              onAdvance={() => advance(developedEntry, title)}
              onUnadvance={() => unadvance(developedEntry, title)}
            />
          </EntryActions>
        ) : (
          <PrepareEntryButton
            title={title}
            disabled={isBusy}
            loading={preparingSourceId === source.id}
            onPrepare={() => prepare(source)}
          />
        );
      }}
    />
  );
}

function ReadOnlySourcesTable(props: SourcesTableProps) {
  const sourcesPage = useDevelopSourcesPage(props);

  return (
    <SourcesTable
      {...props}
      sourcesPage={sourcesPage}
      renderActions={(source) => (
        <EntryActions>
          <SourceDecisionBadge advancing={isSourceAdvancing(source)} />
        </EntryActions>
      )}
    />
  );
}

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
  decisionSlug,
  scope,
  showRecommendations,
  sourcesPage,
  renderActions,
}: SourcesTableProps & {
  sourcesPage: ReturnType<typeof useDevelopSourcesPage>;
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
                        <SourceTitleLink
                          title={title}
                          href={decisionProposalDevelopHref({
                            decisionSlug,
                            profileId:
                              source.developedProposals[0]?.profileId ??
                              source.profileId,
                          })}
                        />
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

function SourceTitleLink({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="text-base font-strong text-foreground hover:underline"
    >
      <bdi>{title}</bdi>
    </Link>
  );
}

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

function EntryActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

function AdvanceEntryButton({
  title,
  status,
  disabled,
  loading,
  onAdvance,
  onUnadvance,
}: {
  title: string;
  status: DevelopedProposal['status'];
  disabled: boolean;
  loading: boolean;
  onAdvance: () => void;
  onUnadvance: () => void;
}) {
  const t = useTranslations('decisions.develop');
  const isDraft = status === ProposalStatus.DRAFT;
  const advanced = !isDraft;
  const actionable = isDraft || status === ProposalStatus.SUBMITTED;

  return (
    <Button
      variant="outline"
      aria-pressed={advanced}
      loading={loading}
      disabled={disabled || !actionable}
      className={advanced ? 'border-primary bg-accent text-primary' : undefined}
      aria-label={
        advanced
          ? t('advancedEntryLabel', { title })
          : t('advanceEntryLabel', { title })
      }
      onClick={isDraft ? onAdvance : onUnadvance}
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

function isDevelopLockedError(error: unknown) {
  return getHttpStatus(error) === 409;
}
