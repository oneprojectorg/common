'use client';

import { useUser } from '@/utils/UserProvider';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProfileOrganizations } from '@/components/screens/ProfileOrganizations';

import { MembersList } from './MembersList';

export const DecisionsTab = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const access = useUser();
  const permission = access.getPermissionsForProfile(profileId);

  return permission.decisions.read ? (
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
  return (
    <TabPanel
      id="decisions"
      className={cn('grow px-4 pt-2 sm:px-6 sm:py-8', className)}
    >
      {children}
    </TabPanel>
  );
};

export const MembersTab = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const access = useUser();
  const permission = access.getPermissionsForProfile(profileId).admin;

  return permission.read ? <Tab id="members">{t('Members')}</Tab> : null;
};

export const MembersTabPanel = ({ profileId }: { profileId: string }) => {
  return (
    <TabPanel id="members" className="grow px-4 sm:px-6 sm:py-0">
      <ProfileOrganizations>
        <MembersList profileId={profileId} />
      </ProfileOrganizations>
    </TabPanel>
  );
};
