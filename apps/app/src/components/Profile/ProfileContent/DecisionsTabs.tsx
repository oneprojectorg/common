'use client';

import { useUser } from '@/utils/UserProvider';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { ReactNode, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProfileOrganizations } from '@/components/screens/ProfileOrganizations';
import { ProfileRelationshipsSkeleton } from '@/components/screens/ProfileRelationships/Skeleton';

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
  const decisionsEnabled = useFeatureFlagEnabled('decision_making') || true;

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
  const decisionsEnabled = useFeatureFlagEnabled('decision_making') || true;
  const t = useTranslations();

  return decisionsEnabled ? (
    <TabPanel id="members" className="flex-grow px-4 sm:px-6 sm:py-0">
      <ProfileOrganizations>
        <ErrorBoundary
          fallback={
            <div className="p-4 text-center text-neutral-charcoal">
              {t('Failed to load members')}
            </div>
          }
        >
          <Suspense fallback={<ProfileRelationshipsSkeleton />}>
            <MembersList profileId={profileId} />
          </Suspense>
        </ErrorBoundary>
      </ProfileOrganizations>
    </TabPanel>
  ) : null;
};
