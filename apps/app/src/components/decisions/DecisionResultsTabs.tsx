'use client';

import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const DecisionResultsTabs = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const t = useTranslations();

  return (
    <Tabs className={cn('gap-6', className)} defaultSelectedKey="funded">
      <TabList className="gap-6 flex">
        <Tab id="funded">{t('Funded Proposals')}</Tab>
        <Tab id="ballot">{t('My Ballot')}</Tab>
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
    <TabPanel id={id} className="sm:p-0 grow">
      {children}
    </TabPanel>
  );
};
