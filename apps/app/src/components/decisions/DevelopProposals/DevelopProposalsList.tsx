'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type InstancePhaseData,
  type ProcessInstance,
  ProposalStatus,
} from '@op/api/encoders';
import { BadgeNumber } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { Suspense, useState } from 'react';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalsLoadError } from '../ProposalsLoadError';
import { DevelopEntriesPanel } from './DevelopEntriesPanel';
import {
  DevelopSourcesPanel,
  DevelopSourcesTableSkeleton,
} from './DevelopSourcesPanel';

type DevelopTab = 'proposals' | 'entries';

/**
 * The develop screen's body: a Proposals tab with the previous phase's
 * proposals (the sources) to prepare entries from, an Entries tab with the
 * entries this phase holds, and a fixed footer with the advancing count and
 * the confirm action.
 */
export function DevelopProposalsList({
  instance,
  sourcePhase,
  decisionSlug,
  entryName,
}: {
  instance: ProcessInstance;
  /** The phase the sources come from: the one before the develop phase. */
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
  entryName: string;
}) {
  const t = useTranslations('decisions.develop');
  const [tab, setTab] = useState<DevelopTab>('proposals');
  const processInstanceId = instance.id;
  const phaseId = instance.currentStateId ?? undefined;

  // Only the totals are read here, so each list is asked for one row.
  const [[entries, advancing]] = trpc.useSuspenseQueries((q) => [
    q.decision.listProposals({ processInstanceId, phaseId, limit: 1 }),
    q.decision.listProposals({
      processInstanceId,
      phaseId,
      status: ProposalStatus.SUBMITTED,
      limit: 1,
    }),
  ]);

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
            <BadgeNumber variant="secondary">{entries.total}</BadgeNumber>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals">
          <APIErrorBoundary
            fallbacks={{ default: () => <ProposalsLoadError /> }}
          >
            <Suspense fallback={<DevelopSourcesTableSkeleton />}>
              <DevelopSourcesPanel
                instance={instance}
                sourcePhase={sourcePhase}
                decisionSlug={decisionSlug}
              />
            </Suspense>
          </APIErrorBoundary>
        </TabsContent>

        <TabsContent value="entries">
          <DevelopEntriesPanel
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            decisionSlug={decisionSlug}
            entryName={entryName}
          />
        </TabsContent>
      </Tabs>

      <FooterBar position="fixed">
        <FooterBarStart>
          <p aria-live="polite" className="flex items-center gap-2 text-base">
            <LuCircleCheck
              aria-hidden
              className={cn(
                'size-4 shrink-0',
                advancing.total > 0 ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            {t('advancingCount', { count: advancing.total })}
          </p>
        </FooterBarStart>
        <FooterBarCenter />
        <FooterBarEnd>
          {/* Confirming a develop phase's selection has no endpoint yet; the
              disabled button holds its place. */}
          <Button disabled>{t('confirmSelectionsAction')}</Button>
        </FooterBarEnd>
      </FooterBar>
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
