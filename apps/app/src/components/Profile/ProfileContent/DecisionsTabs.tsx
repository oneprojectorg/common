'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProfileOrganizations } from '@/components/screens/ProfileOrganizations';

import { MembersList } from './MembersList';

export const DecisionsTab = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const access = useUser();
  const canReadDecisions =
    access.getPermissionsForProfile(profileId).decisions.read;

  const decisionProfiles = trpc.decision.listDecisionProfiles.useQuery({
    stewardProfileId: profileId,
    limit: 1,
    status: ProcessStatus.PUBLISHED,
  });

  const legacyInstances = trpc.decision.listInstances.useQuery(
    { stewardProfileId: profileId, limit: 1, offset: 0 },
    { retry: false, enabled: canReadDecisions },
  );

  const hasDecisionProfiles = (decisionProfiles.data?.items?.length ?? 0) > 0;
  const hasLegacyInstances = (legacyInstances.data?.instances?.length ?? 0) > 0;
  const hasActiveDecisions = hasDecisionProfiles || hasLegacyInstances;

  if (!hasActiveDecisions) {
    return null;
  }

  return (
    <Tab id="decisions">
      {t('Decisions')}
      {hasDecisionProfiles && (
        <span className="ml-1.5 inline-block size-1 rounded-full bg-functional-green" />
      )}
    </Tab>
  );
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
