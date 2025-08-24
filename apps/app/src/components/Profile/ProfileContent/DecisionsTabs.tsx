'use client';

import { useUser } from '@/utils/UserProvider';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const DecisionsTab = ({ profileId }: { profileId: string }) => {
  const decisionsEnabled = useFeatureFlagEnabled('decision_making');
  const t = useTranslations();
  const access = useUser();
  const permission = access.getPermissionsForProfile(profileId);

  return decisionsEnabled && permission.decisions.read ? (
    <Tab id="decisions">{t('Decisions')}</Tab>
  ) : null;
};

export const DecisionsTabPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const decisionsEnabled = useFeatureFlagEnabled('decision_making');

  return decisionsEnabled ? (
    <TabPanel id="decisions" className={cn('px-0', className)}>
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
