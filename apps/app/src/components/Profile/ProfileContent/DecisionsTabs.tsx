'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { ReactNode, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProfileOrganizations } from '@/components/screens/ProfileOrganizations';

import { MembersList } from './MembersList';

const DecisionsTabInner = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();

  const [decisionProfiles] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery({
      stewardProfileId: profileId,
      limit: 1,
      status: ProcessStatus.PUBLISHED,
    });

  const legacyInstances = trpc.decision.listInstances.useQuery(
    { stewardProfileId: profileId, limit: 1, offset: 0 },
    { retry: false },
  );

  const hasDecisionProfiles = decisionProfiles.items.length > 0;
  const hasLegacyInstances = (legacyInstances.data?.instances?.length ?? 0) > 0;

  if (!hasDecisionProfiles && !hasLegacyInstances) {
    return null;
  }

  return <Tab id="decisions">{t('Decisions')}</Tab>;
};

export const DecisionsTab = ({ profileId }: { profileId: string }) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <DecisionsTabInner profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
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
