'use client';

import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const FollowersTab = () => {
  const t = useTranslations();

  return <Tab id="followers">{t('Followers')}</Tab>;
};

export const FollowersTabPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <TabPanel
      id="followers"
      className={cn('px-4 py-2 sm:px-6 sm:py-0', className)}
    >
      {children}
    </TabPanel>
  );
};
