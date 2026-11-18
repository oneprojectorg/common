'use client';

import type { ProcessInstance } from '@op/api/encoders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useTranslations } from '@/lib/i18n';

import { DevelopAdminCategoriesPanel } from '../DevelopProposals/DevelopAdminCategoriesPanel';
import { DevelopAdminEntriesPanel } from '../DevelopProposals/DevelopAdminEntriesPanel';
import { DevelopAdminPublishFooter } from '../DevelopProposals/DevelopAdminPublishFooter';
import { DevelopPageShell, getEntryName } from './DevelopPageShell';

const DEVELOP_TABS = ['entries', 'categories'] as const;
const DEFAULT_DEVELOP_TAB = 'entries';

// Not `tab`, which the review screen on this route reads.
const DEVELOP_TAB_PARAM = 'developTab';

const developTabParser = parseAsStringLiteral(DEVELOP_TABS);

/**
 * The admin's develop screen: the entries of the phase, the categories with
 * their facilitators' confirms (confirm or unconfirm on their behalf), and a
 * fixed footer to publish once every category is confirmed.
 */
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
  const developPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const phaseId = instance.currentStateId ?? undefined;
  const entryName = getEntryName({ developPhase, t });

  const handleTabChange = (value: string) => {
    const next = developTabParser.parse(value);
    if (next) {
      // Strip the param on the default tab so the URL stays clean.
      void setTab(next === DEFAULT_DEVELOP_TAB ? null : next);
    }
  };

  return (
    <DevelopPageShell>
      <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
        {/* The first label starts flush with the count and the table's first
            column below it, underline included. */}
        <TabsList
          variant="line"
          aria-label={t('develop.tabsLabel')}
          className="[&>[data-slot=tabs-trigger]:first-child]:ps-0"
        >
          <TabsTrigger value="entries">
            <bdi>{entryName}</bdi>
          </TabsTrigger>
          <TabsTrigger value="categories">
            {t('develop.categoriesTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <DevelopAdminEntriesPanel
            processInstanceId={instance.id}
            phaseId={phaseId}
            decisionSlug={decisionSlug}
            entryName={entryName}
          />
        </TabsContent>

        <TabsContent value="categories">
          <DevelopAdminCategoriesPanel processInstanceId={instance.id} />
        </TabsContent>
      </Tabs>

      <DevelopAdminPublishFooter processInstanceId={instance.id} />
    </DevelopPageShell>
  );
}
