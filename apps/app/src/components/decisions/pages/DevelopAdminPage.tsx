'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import { isVotingPhase } from '@op/common/client';
import { BadgeNumber } from '@op/sense/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DevelopAdminCategoriesPanel } from '../DevelopProposals/DevelopAdminCategoriesPanel';
import { DevelopAdminEntriesPanel } from '../DevelopProposals/DevelopAdminEntriesPanel';
import { DevelopAdminPublishFooter } from '../DevelopProposals/DevelopAdminPublishFooter';
import { DevelopAdminSourcesPanel } from '../DevelopProposals/DevelopAdminSourcesPanel';
import { DevelopPageShell } from './DevelopPageShell';

const DEVELOP_TABS = ['categories', 'proposals', 'entries'] as const;
const DEFAULT_DEVELOP_TAB = 'categories';

// Not `tab`, which the review screen on this route reads.
const DEVELOP_TAB_PARAM = 'developTab';

const developTabParser = parseAsStringLiteral(DEVELOP_TABS);

export function DevelopAdminPage({
  instance,
  decisionSlug,
}: {
  instance: ProcessInstance;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');
  const [tab, setTab] = useQueryState(
    DEVELOP_TAB_PARAM,
    developTabParser.withDefault(DEFAULT_DEVELOP_TAB),
  );
  const phases = instance.instanceData.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const sourcePhase =
    currentIndex > 0 ? (phases[currentIndex - 1] ?? null) : null;
  const nextPhase = currentIndex >= 0 ? phases[currentIndex + 1] : undefined;
  const votingStartDate =
    nextPhase && isVotingPhase(nextPhase) ? nextPhase.startDate : undefined;
  const phaseId = instance.currentStateId ?? undefined;
  const entryName = t('develop.defaultEntryName');

  const handleTabChange = (value: string) => {
    const next = developTabParser.parse(value);
    if (next) {
      void setTab(next === DEFAULT_DEVELOP_TAB ? null : next);
    }
  };

  return (
    <DevelopPageShell>
      <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
        {/* Aligns the first label and its underline with the table's first column. */}
        <TabsList
          variant="line"
          aria-label={t('develop.tabsLabel')}
          className="[&>[data-slot=tabs-trigger]:first-child]:ps-0"
        >
          <TabsTrigger value="categories">
            {t('develop.categoriesTab')}
          </TabsTrigger>
          <TabsTrigger value="proposals">{t('allProposalsTab')}</TabsTrigger>
          <TabsTrigger value="entries">
            <bdi>{entryName}</bdi>
            <APIErrorBoundary fallbacks={{ default: () => null }}>
              <Suspense fallback={null}>
                <DevelopAdminEntriesTotalSuspense
                  processInstanceId={instance.id}
                  phaseId={phaseId}
                />
              </Suspense>
            </APIErrorBoundary>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <DevelopAdminCategoriesPanel processInstanceId={instance.id} />
        </TabsContent>

        <TabsContent value="proposals">
          <DevelopAdminSourcesPanel
            processInstanceId={instance.id}
            sourcePhase={sourcePhase}
            decisionSlug={decisionSlug}
          />
        </TabsContent>

        <TabsContent value="entries">
          <DevelopAdminEntriesPanel
            processInstanceId={instance.id}
            phaseId={phaseId}
            decisionSlug={decisionSlug}
            entryName={entryName}
          />
        </TabsContent>
      </Tabs>

      <DevelopAdminPublishFooter
        processInstanceId={instance.id}
        votingStartDate={votingStartDate}
      />
    </DevelopPageShell>
  );
}

function DevelopAdminEntriesTotalSuspense({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}) {
  const [{ total }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId,
    phaseId,
    status: ProposalStatus.SUBMITTED,
    limit: 1,
  });

  return <BadgeNumber variant="secondary">{total}</BadgeNumber>;
}
