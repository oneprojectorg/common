'use client';

import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
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
    <Tabs className={className} defaultSelectedKey="funded">
      <div className="border-b border-neutral-gray1 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <TabList className="flex gap-6">
            <Tab id="funded">{t('Funded Proposals')}</Tab>
            <Tab id="ballot">{t('My Ballot')}</Tab>
          </TabList>
        </div>
      </div>
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
    <TabPanel id={id} className="flex-grow">
      {children}
    </TabPanel>
  );
};
