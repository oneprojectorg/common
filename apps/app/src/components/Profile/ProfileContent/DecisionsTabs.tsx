'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProcessStatus, VISIBLE_DECISION_STATUSES } from '@op/api/encoders';
import { Header2 } from '@op/sense/Header';
import { TabsContent, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { AccessBoundary } from '@/components/AccessBoundary';
import { ProfileOrganizations } from '@/components/screens/ProfileOrganizations';

import { MembersList } from './MembersList';

export const DecisionsTab = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const access = useUser();
  const canReadDecisions =
    access.getPermissionsForProfile(profileId).decisions.read;

  const decisionProfiles = trpc.decision.listDecisionProfiles.useQuery({
    stewardProfileId: profileId,
    status: VISIBLE_DECISION_STATUSES,
  });

  const legacyInstances = trpc.decision.listLegacyInstances.useQuery(
    { ownerProfileId: profileId },
    { retry: false, enabled: canReadDecisions },
  );

  const hasDecisionProfiles = (decisionProfiles.data?.items?.length ?? 0) > 0;
  const hasLegacyInstances = (legacyInstances.data?.length ?? 0) > 0;
  const hasPublishedDecisions = decisionProfiles.data?.items?.some(
    (item) => item.processInstance.status === ProcessStatus.PUBLISHED,
  );

  if (!hasDecisionProfiles && !hasLegacyInstances) {
    return null;
  }

  return (
    <TabsTrigger value="decisions">
      {t('Decisions')}
      {hasPublishedDecisions && (
        <span className="ms-1.5 inline-block size-1 rounded-full bg-success" />
      )}
    </TabsTrigger>
  );
};

export const DecisionsTabPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const t = useTranslations();
  return (
    <TabsContent
      value="decisions"
      className={cn(
        'flex grow flex-col gap-2 px-4 pt-2 sm:gap-0 sm:p-0',
        className,
      )}
    >
      <Header2 className="text-title sm:hidden">{t('Decisions')}</Header2>
      {children}
    </TabsContent>
  );
};

export const MembersTab = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  return (
    <AccessBoundary required={{ admin: { read: true } }} profileId={profileId}>
      <TabsTrigger value="members">{t('Members')}</TabsTrigger>
    </AccessBoundary>
  );
};

export const MembersTabPanel = ({ profileId }: { profileId: string }) => {
  return (
    <TabsContent value="members" className="grow px-4 sm:px-6 sm:py-0">
      <ProfileOrganizations>
        <MembersList profileId={profileId} />
      </ProfileOrganizations>
    </TabsContent>
  );
};
