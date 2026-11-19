'use client';

import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import {
  type DevelopSource,
  isReviewPhase,
  resolveReviewSettings,
} from '@op/common/client';
import { Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { TableBody, TableHead, TableHeader, TableRow } from '@op/sense/Table';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';
import { ProposalReviewDecorationProvider } from '../proposalReviewDecoration';
import {
  DevelopSourceActionsCell,
  DevelopSourceAdvanceEntryButton,
  DevelopSourceDecisionBadge,
  DevelopSourceEditEntryLink,
  DevelopSourceNameCell,
  DevelopSourcePrepareEntryButton,
  DevelopSourceRecommendationsCell,
  DevelopSourceTitleLink,
  DevelopSourcesNextPage,
  DevelopSourcesProvider,
  DevelopSourcesTable,
  NoSourcesEmpty,
  useDevelopSourceTitle,
  useDevelopSources,
  useDevelopSourcesMeta,
  useDevelopSourcesState,
} from './DevelopSourcesParts';
import { getDevelopSourceScope } from './developSources';

interface DevelopSourcesPanelProps {
  instance: ProcessInstance;
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
}

interface SourcesTableProps {
  /** Show the overall-recommendation column: the caller may read the reviews. */
  showRecommendations: boolean;
}

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
      <DevelopSourcesProvider
        processInstanceId={instance.id}
        sourcePhaseId={sourcePhase.phaseId}
        scope={scope}
        decisionSlug={decisionSlug}
      >
        {renderTable({ showRecommendations: canReadReviews })}
      </DevelopSourcesProvider>
    </ProposalReviewDecorationProvider>
  );
}

function EditableSourcesTable({ showRecommendations }: SourcesTableProps) {
  const { sources } = useDevelopSources();

  return (
    <SourcesTableFrame showRecommendations={showRecommendations}>
      {sources.map((source) => (
        <EditableSourceRow
          key={source.id}
          source={source}
          showRecommendations={showRecommendations}
        />
      ))}
    </SourcesTableFrame>
  );
}

function EditableSourceRow({
  source,
  showRecommendations,
}: {
  source: DevelopSource;
  showRecommendations: boolean;
}) {
  const { decisionSlug } = useDevelopSourcesMeta();
  const { isPreparing } = useDevelopSourcesState();
  const title = useDevelopSourceTitle(source);
  const openInSheet = useOpenProposalInSheet();
  // One entry per source for now: Edit and Advance act on the oldest one.
  const developedEntry = source.developedProposals[0];

  return (
    <TableRow>
      <DevelopSourceNameCell source={source}>
        <DevelopSourceTitleLink
          title={title}
          href={decisionProposalHref({
            decisionSlug,
            profileId: source.profileId,
          })}
          onClick={openInSheet(source.profileId)}
        />
      </DevelopSourceNameCell>
      {showRecommendations ? (
        <DevelopSourceRecommendationsCell source={source} />
      ) : null}
      <DevelopSourceActionsCell>
        {developedEntry ? (
          <>
            <DevelopSourceEditEntryLink
              title={title}
              href={decisionProposalDevelopHref({
                decisionSlug,
                profileId: developedEntry.profileId,
              })}
            />
            <DevelopSourceAdvanceEntryButton
              entry={developedEntry}
              title={title}
              disabled={isPreparing}
            />
          </>
        ) : (
          <DevelopSourcePrepareEntryButton
            source={source}
            disabled={isPreparing}
          />
        )}
      </DevelopSourceActionsCell>
    </TableRow>
  );
}

function ReadOnlySourcesTable({ showRecommendations }: SourcesTableProps) {
  const { sources } = useDevelopSources();

  return (
    <SourcesTableFrame showRecommendations={showRecommendations}>
      {sources.map((source) => (
        <ReadOnlySourceRow
          key={source.id}
          source={source}
          showRecommendations={showRecommendations}
        />
      ))}
    </SourcesTableFrame>
  );
}

function ReadOnlySourceRow({
  source,
  showRecommendations,
}: {
  source: DevelopSource;
  showRecommendations: boolean;
}) {
  const { decisionSlug } = useDevelopSourcesMeta();
  const title = useDevelopSourceTitle(source);

  return (
    <TableRow>
      <DevelopSourceNameCell source={source}>
        <DevelopSourceTitleLink
          title={title}
          href={decisionProposalDevelopHref({
            decisionSlug,
            // The source's own develop view says it has no entry yet.
            profileId:
              source.developedProposals[0]?.profileId ?? source.profileId,
          })}
        />
      </DevelopSourceNameCell>
      {showRecommendations ? (
        <DevelopSourceRecommendationsCell source={source} />
      ) : null}
      <DevelopSourceActionsCell>
        <DevelopSourceDecisionBadge source={source} />
      </DevelopSourceActionsCell>
    </TableRow>
  );
}

/** The count, the empty state, the table and its next page around the rows. */
function SourcesTableFrame({
  showRecommendations,
  children,
}: {
  showRecommendations: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('decisions');
  const { sources, total } = useDevelopSources();
  const { query } = useDevelopSourcesMeta();

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
        <NoSourcesEmpty scope={query.scope} />
      ) : (
        <div className="flex flex-col">
          <DevelopSourcesTable className="min-w-3xl">
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
            <TableBody>{children}</TableBody>
          </DevelopSourcesTable>

          <DevelopSourcesNextPage>
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 border-b py-4"
              >
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-11 w-28" />
              </div>
            ))}
          </DevelopSourcesNextPage>
        </div>
      )}
    </div>
  );
}
