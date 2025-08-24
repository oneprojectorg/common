'use client';

import { useUser } from '@/utils/UserProvider';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { ReactNode, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { MembersList } from './MembersList';

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

export const MembersTab = ({ profileId }: { profileId: string }) => {
  const decisionsEnabled = useFeatureFlagEnabled('decision_making');
  const t = useTranslations();
  const access = useUser();
  const permission = access.getPermissionsForProfile(profileId).admin;

  return decisionsEnabled && permission.read ? (
    <Tab id="members">{t('Members')}</Tab>
  ) : null;
};

export const MembersTabPanel = ({ profileId }: { profileId: string }) => {
  const decisionsEnabled = useFeatureFlagEnabled('decision_making');

  return decisionsEnabled ? (
    <TabPanel id="members" className="px-0">
      <ErrorBoundary
        fallback={
          <div className="p-4 text-center text-neutral-charcoal">
            Failed to load members
          </div>
        }
      >
        <Suspense fallback={<MembersList.Skeleton />}>
          <MembersList profileId={profileId} />
        </Suspense>
      </ErrorBoundary>
    </TabPanel>
  ) : null;
};
