'use client';

import type { Organization, Profile } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { TabPanel } from '@op/ui/Tabs';

import type { SchemaType } from '@/components/Profile/CreateDecisionProcessModal/schemas/schemaLoader';
import {
  OrganizationProfileGrid,
  ProfileGrid,
  ProfileTabList,
  ProfileTabs,
  ProfileTabsMobile,
} from '@/components/Profile/ProfileContent';
import {
  DecisionsTab,
  DecisionsTabPanel,
  MembersTab,
  MembersTabPanel,
} from '@/components/Profile/ProfileContent/DecisionsTabs';
import {
  DesktopIndividualTabs,
  DesktopOrganizationTabs,
} from '@/components/Profile/ProfileContent/DesktopTabs';
import {
  FollowersTab,
  FollowersTabPanel,
} from '@/components/Profile/ProfileContent/IndividualTabs';
import { ProfileDecisionsSuspense } from '@/components/Profile/ProfileDecisions';

import { ProfileFollowers } from '../ProfileFollowers';
import { ProfileFollowing } from '../ProfileFollowing';
import {
  ProfileOrganizations,
  ProfileOrganizationsSuspense,
} from '../ProfileOrganizations';
import { ProfileRelationshipsSuspense } from '../ProfileRelationships';

export const ProfileTabsRenderer = ({
  organization,
  profile,
  initialTab,
  decisionsEnabled,
  schema,
}: {
  organization: Organization;
  profile: Profile;
  initialTab?: string;
  decisionsEnabled: boolean;
  schema: SchemaType;
}) => {
  const isMobile = useMediaQuery('(max-width: 640px)');

  if (isMobile) {
    return (
      <ProfileTabsMobile
        profile={organization}
        initialTab={initialTab}
        decisionsContent={
          <ProfileDecisionsSuspense profileId={profile.id} schema={schema} />
        }
        followersContent={<ProfileFollowers profileId={profile.id} />}
      >
        <ProfileRelationshipsSuspense
          slug={profile.slug}
          showBreadcrumb={false}
        />
      </ProfileTabsMobile>
    );
  }

  return (
    <ProfileTabs initialTab={initialTab} profileType="org">
      <ProfileTabList>
        <DesktopOrganizationTabs />
        <FollowersTab />
        <MembersTab profileId={profile.id} />
        {decisionsEnabled && <DecisionsTab profileId={profile.id} />}
      </ProfileTabList>

      <TabPanel id="home" className="flex grow flex-col sm:p-0">
        <OrganizationProfileGrid profile={organization} />
      </TabPanel>
      <TabPanel id="relationships" className="grow px-4 sm:px-6 sm:py-0">
        <ProfileOrganizations>
          <ProfileRelationshipsSuspense
            slug={profile.slug}
            showBreadcrumb={false}
          />
        </ProfileOrganizations>
      </TabPanel>
      <FollowersTabPanel>
        <ProfileFollowers profileId={profile.id} />
      </FollowersTabPanel>
      {decisionsEnabled && (
        <>
          <DecisionsTabPanel>
            <ProfileDecisionsSuspense profileId={profile.id} schema={schema} />
          </DecisionsTabPanel>
          <MembersTabPanel profileId={profile.id} />
        </>
      )}
    </ProfileTabs>
  );
};

export const IndividualProfileTabsRenderer = ({
  userProfile,
  profile,
  initialTab,
}: {
  userProfile: Organization;
  profile: Profile;
  initialTab?: string;
}) => {
  const isMobile = useMediaQuery('(max-width: 640px)');

  if (isMobile) {
    return (
      <ProfileTabsMobile
        profile={userProfile}
        initialTab={initialTab}
        followingContent={<ProfileFollowing profileId={profile.id} />}
      >
        <ProfileOrganizationsSuspense
          slug={profile.slug}
          showBreadcrumb={false}
        />
      </ProfileTabsMobile>
    );
  }

  return (
    <ProfileTabs initialTab={initialTab} profileType="individual">
      <ProfileTabList>
        <DesktopIndividualTabs />
      </ProfileTabList>

      <TabPanel id="about" className="sm:p-0">
        <ProfileGrid profile={userProfile} />
      </TabPanel>
      <TabPanel id="organizations" className="px-4 sm:px-6 sm:py-0">
        <ProfileOrganizations>
          <ProfileOrganizationsSuspense
            slug={profile.slug}
            showBreadcrumb={false}
          />
        </ProfileOrganizations>
      </TabPanel>
      <TabPanel id="following" className="px-4 sm:px-6 sm:py-0">
        <ProfileFollowing profileId={profile.id} />
      </TabPanel>
    </ProfileTabs>
  );
};
