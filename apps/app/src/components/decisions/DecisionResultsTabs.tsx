'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const DecisionResultsTabs = ({
  children,
  className,
  showBallotTab = true,
  showAnalysisTab = false,
}: {
  children: ReactNode;
  className?: string;
  /** Whether to surface the "My ballot" tab — only when a voting phase took place. */
  showBallotTab?: boolean;
  /**
   * Whether to surface the "Analysis" tab.
   *
   * The panel reads a stored snapshot and cannot produce one, so a decision
   * nobody has analysed would get a tab whose only content is "no analysis
   * yet". The caller knows whether there is one; this keeps the tab row honest
   * about what is behind it.
   */
  showAnalysisTab?: boolean;
}) => {
  const t = useTranslations();

  return (
    <Tabs className={cn('gap-6', className)} defaultValue="funded">
      {/* The rail lives on a wrapper, not the list — sense's `line` variant
          draws the active indicator only. Mirrors ReviewPage's tab row. */}
      <div className="w-full overflow-x-auto border-b">
        <TabsList
          variant="line"
          className="flex gap-6"
          aria-label={t('Results sections')}
        >
          <TabsTrigger value="funded">{t('Selected proposals')}</TabsTrigger>
          <TabsTrigger value="all-proposals">{t('All proposals')}</TabsTrigger>
          {showBallotTab ? (
            <TabsTrigger value="ballot">{t('My ballot')}</TabsTrigger>
          ) : null}
          {showAnalysisTab ? (
            <TabsTrigger value="analysis">{t('Analysis')}</TabsTrigger>
          ) : null}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
};

export const DecisionResultsTabPanel = ({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) => {
  return (
    <TabsContent value={value} className="grow">
      {children}
    </TabsContent>
  );
};
