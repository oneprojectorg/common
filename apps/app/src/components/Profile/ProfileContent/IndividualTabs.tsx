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

export const MembersTab = () => {
  const decisionsEnabled = useFeatureFlagEnabled('decision_making');
  const t = useTranslations();
  return decisionsEnabled ? <Tab id="members">{t('Members')}</Tab> : null;
};

export const MembersTabPanel = ({ children }: { children: ReactNode }) => {
  const decisionsEnabled = useFeatureFlagEnabled('decision_making');

  return decisionsEnabled ? (
    <TabPanel id="members" className="px-4 py-2">
      <div className="text-center text-neutral-gray4">{children}</div>
    </TabPanel>
  ) : null;
};
