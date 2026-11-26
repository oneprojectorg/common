'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type InstancePhaseData,
  type ProcessInstance,
  ProposalStatus,
} from '@op/api/encoders';
import type { DevelopConfirmStateSchema } from '@op/common/client';
import { BadgeNumber } from '@op/sense/Badge';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalsLoadError } from '../ProposalsLoadError';
import { getSchemaName } from '../getSchemaName';
import {
  ConfirmSelectionsAction,
  DevelopConfirmFooter,
  UnconfirmSelectionsAction,
} from './DevelopConfirmActions';
import {
  DevelopEntriesPanel,
  DevelopEntriesReadOnlyPanel,
} from './DevelopEntriesPanel';
import {
  DevelopSourcesPanel,
  DevelopSourcesReadOnlyPanel,
  DevelopSourcesTableSkeleton,
} from './DevelopSourcesPanel';
import {
  type DevelopSourcesInput,
  getDevelopSourceScope,
  getDevelopSourcesInput,
} from './developSources';

type DevelopTab = 'proposals' | 'entries';

/**
 * The develop screen's body: a Proposals tab with the previous phase's
 * proposals (the sources) to prepare entries from, an Entries tab with the
 * entries advancing from this phase, and a fixed footer with their count and
 * the confirm action.
 *
 * The caller's develop state comes from the server: once they confirmed
 * their work (or the window closed), both tabs show the read-only variants,
 * and the footer offers Unconfirm instead of Confirm. Every read here
 * refreshes through the proposals channel that confirm and unconfirm publish.
 */
export function DevelopProposalsList({
  instance,
  sourcePhase,
  decisionSlug,
}: {
  instance: ProcessInstance;
  /** The phase the sources come from: the one before the develop phase. */
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const [tab, setTab] = useState<DevelopTab>('proposals');
  const processInstanceId = instance.id;
  const phaseId = instance.currentStateId ?? undefined;

  // Only the total of the entries is read here, so it is asked for one row;
  // the develop state decides the variants and the footer action.
  const [[advancing, developState]] = trpc.useSuspenseQueries((q) => [
    q.decision.listProposals({
      processInstanceId,
      phaseId,
      status: ProposalStatus.SUBMITTED,
      limit: 1,
    }),
    q.decision.getDevelopConfirmState({ processInstanceId }),
  ]);
  const entryName = getSchemaName({
    template: advancing.items[0]?.proposalTemplate ?? null,
    fallback: t('defaultEntryName'),
  });
  const isReadOnly = developState.lock !== null;
  const sourcesInput = sourcePhase
    ? getDevelopSourcesInput({
        processInstanceId,
        sourcePhaseId: sourcePhase.phaseId,
        scope: getDevelopSourceScope(instance),
      })
    : undefined;

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value: DevelopTab) => setTab(value)}
        className="gap-6"
      >
        {/* The first label starts flush with the count and the table's first
            column below it, underline included. */}
        <TabsList
          variant="line"
          aria-label={t('tabsLabel')}
          className="[&>[data-slot=tabs-trigger]:first-child]:ps-0"
        >
          <TabsTrigger value="proposals">{t('proposalsTab')}</TabsTrigger>
          <TabsTrigger value="entries">
            <bdi>{entryName}</bdi>
            <BadgeNumber variant="secondary">{advancing.total}</BadgeNumber>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals">
          <APIErrorBoundary
            fallbacks={{ default: () => <ProposalsLoadError /> }}
          >
            <Suspense fallback={<DevelopSourcesTableSkeleton />}>
              {isReadOnly ? (
                <DevelopSourcesReadOnlyPanel
                  instance={instance}
                  sourcePhase={sourcePhase}
                  decisionSlug={decisionSlug}
                />
              ) : (
                <DevelopSourcesPanel
                  instance={instance}
                  sourcePhase={sourcePhase}
                  decisionSlug={decisionSlug}
                />
              )}
            </Suspense>
          </APIErrorBoundary>
        </TabsContent>

        <TabsContent value="entries">
          {isReadOnly ? (
            <DevelopEntriesReadOnlyPanel
              isCategoryConfirmed={developState.lock === 'confirmed'}
              processInstanceId={processInstanceId}
              phaseId={phaseId}
              decisionSlug={decisionSlug}
              entryName={entryName}
            />
          ) : (
            <DevelopEntriesPanel
              processInstanceId={processInstanceId}
              phaseId={phaseId}
              decisionSlug={decisionSlug}
              entryName={entryName}
            />
          )}
        </TabsContent>
      </Tabs>

      <DevelopConfirmFooter advancingCount={advancing.total}>
        <FooterConfirmAction
          developState={developState}
          processInstanceId={processInstanceId}
          advancingCount={advancing.total}
          sourcesInput={sourcesInput}
        />
      </DevelopConfirmFooter>
    </>
  );
}

export function DevelopProposalsListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex gap-6 border-b pb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <DevelopSourcesTableSkeleton />
    </div>
  );
}

/**
 * Only a caller with a category of their own for this phase confirms, and
 * not once the window closed: Confirm until they confirmed, then Unconfirm.
 */
function FooterConfirmAction({
  developState,
  processInstanceId,
  advancingCount,
  sourcesInput,
}: {
  developState: DevelopConfirmStateSchema;
  processInstanceId: string;
  advancingCount: number;
  sourcesInput?: DevelopSourcesInput;
}) {
  if (!developState.canConfirm || developState.lock === 'windowClosed') {
    return null;
  }

  if (developState.lock === 'confirmed') {
    return (
      <UnconfirmSelectionsAction
        processInstanceId={processInstanceId}
        categoryNames={developState.categoryNames}
      />
    );
  }

  return (
    <ConfirmSelectionsAction
      processInstanceId={processInstanceId}
      categoryNames={developState.categoryNames}
      advancingCount={advancingCount}
      sourcesInput={sourcesInput}
    />
  );
}
