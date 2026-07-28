'use client';

import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const DecisionResultsTabs = ({
  children,
  className,
  showBallotTab = true,
}: {
  children: ReactNode;
  className?: string;
  /** Whether to surface the "My Ballot" tab — only when a voting phase took place. */
  showBallotTab?: boolean;
}) => {
  const t = useTranslations();

  return (
    <Tabs className={cn('gap-6', className)} defaultSelectedKey="funded">
      <TabList className="flex gap-6">
        <Tab id="funded">{t('Selected Proposals')}</Tab>
        <Tab id="all-proposals">{t('All proposals')}</Tab>
        {showBallotTab ? <Tab id="ballot">{t('My Ballot')}</Tab> : null}
      </TabList>
      {children}
    </Tabs>
  );
};

export const DecisionResultsTabPanel = ({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) => {
  return (
    <TabPanel id={id} className="grow sm:p-0">
      {children}
    </TabPanel>
  );
};
