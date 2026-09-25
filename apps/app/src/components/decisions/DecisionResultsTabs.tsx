'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const DecisionResultsTabs = ({
  children,
  className,
  showBallotTab = true,
  showMyProposalsTab = true,
}: {
  children: ReactNode;
  className?: string;
  /** Whether to surface the "My ballot" tab — only when a voting phase took place. */
  showBallotTab?: boolean;
  /** Whether to surface the "My proposals" tab — needs a profile to filter on. */
  showMyProposalsTab?: boolean;
}) => {
  const t = useTranslations('decisions');

  return (
    <Tabs className={cn('gap-6', className)} defaultValue="funded">
      {/* The rail lives on a wrapper, not the list — sense's `line` variant
          draws the active indicator only. Mirrors ReviewPage's tab row. */}
      <div className="w-full overflow-x-auto border-b">
        <TabsList
          variant="line"
          className="flex gap-6"
          aria-label={t('resultsSectionsLabel')}
        >
          <TabsTrigger value="funded">
            {t('review.selectedProposalsHeading')}
          </TabsTrigger>
          <TabsTrigger value="all-proposals">
            {t('proposals.allProposalsOption')}
          </TabsTrigger>
          {showMyProposalsTab ? (
            <TabsTrigger value="my-proposals">
              {t('proposals.myProposalsOption')}
            </TabsTrigger>
          ) : null}
          {showBallotTab ? (
            <TabsTrigger value="ballot">
              {t('proposals.myBallotOption')}
            </TabsTrigger>
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
