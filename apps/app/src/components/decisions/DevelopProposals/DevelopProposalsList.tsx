'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type InstancePhaseData,
  type ProcessInstance,
  ProposalStatus,
} from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { Suspense, useState } from 'react';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalTabList, ProposalTabTrigger } from '../Proposal/ProposalTabs';
import { ProposalsLoadError } from '../ProposalsLoadError';
import type { ProposalRoute } from '../proposalHrefs';
import { DevelopEntriesPanel } from './DevelopEntriesPanel';
import {
  DevelopOriginsPanel,
  DevelopOriginsTableSkeleton,
} from './DevelopOriginsPanel';

type DevelopTab = 'proposals' | 'entries';

/**
 * The develop screen's body: a Proposals tab with the previous phase's
 * proposals (the origins) to prepare entries from, an Entries tab with the
 * entries this phase holds, and a fixed footer with the advancing count and
 * the confirm action.
 */
export function DevelopProposalsList({
  instance,
  originPhase,
  slug,
  decisionSlug,
}: {
  instance: ProcessInstance;
  /** The phase the origins come from: the one before the develop phase. */
  originPhase: InstancePhaseData | null;
  slug: string;
  decisionSlug?: string;
}) {
  const t = useTranslations('decisions.develop');
  const [tab, setTab] = useState<DevelopTab>('proposals');
  const processInstanceId = instance.id;
  const phaseId = instance.currentStateId ?? undefined;
  const route: Omit<ProposalRoute, 'profileId'> = {
    decisionSlug,
    slug,
    instanceId: processInstanceId,
  };

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
        <ProposalTabList
          aria-label={t('tabsLabel')}
          className="[&>[data-slot=tabs-trigger]:first-child]:ps-0"
        >
          <ProposalTabTrigger value="proposals">
            {t('proposalsTab')}
          </ProposalTabTrigger>
          <ProposalTabTrigger value="entries" count={entries.total}>
            {t('entriesTab')}
          </ProposalTabTrigger>
        </ProposalTabList>

        <TabsContent value="proposals">
          <APIErrorBoundary
            fallbacks={{ default: () => <ProposalsLoadError /> }}
          >
            <Suspense fallback={<DevelopOriginsTableSkeleton />}>
              <DevelopOriginsPanel
                instance={instance}
                originPhase={originPhase}
                route={route}
              />
            </Suspense>
          </APIErrorBoundary>
        </TabsContent>

        <TabsContent value="entries">
          <DevelopEntriesPanel
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            totalEntries={entries.total}
            route={route}
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
      <DevelopOriginsTableSkeleton />
    </div>
  );
}
