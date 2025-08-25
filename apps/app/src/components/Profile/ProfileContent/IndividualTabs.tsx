'use client';

import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const FollowersTab = () => {
  const individualUsersEnabled = useFeatureFlagEnabled('individual_users');
  const t = useTranslations();

  return individualUsersEnabled ? (
    <Tab id="followers">{t('Followers')}</Tab>
  ) : null;
};

export const FollowersTabPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const individualUsersEnabled = useFeatureFlagEnabled('individual_users');

  return individualUsersEnabled ? (
    <TabPanel id="followers" className={cn('px-4 py-2', className)}>
      {children}
    </TabPanel>
  ) : null;
};
