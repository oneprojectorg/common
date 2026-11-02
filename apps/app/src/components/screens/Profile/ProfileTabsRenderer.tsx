'use client';

import type { Organization, Profile } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { TabsContent } from '@op/sense/Tabs';
import { screens } from '@op/styles/constants';

import {
  OrganizationProfileGrid,
  ProfileColumn,
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
}: {
  organization: Organization;
  profile: Profile;
  initialTab?: string;
}) => {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

  if (isMobile) {
    return (
      <ProfileTabsMobile
        profile={organization}
        initialTab={initialTab}
        decisionsContent={<ProfileDecisionsSuspense profileId={profile.id} />}
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
      <ProfileColumn className="flex grow flex-col gap-6">
        <div className="border-b">
          <ProfileTabList className="px-0 sm:px-0">
            <DesktopOrganizationTabs />
            <FollowersTab />
            <MembersTab profileId={profile.id} />
            <DecisionsTab profileId={profile.id} />
          </ProfileTabList>
        </div>
        <TabsContent value="home" className="flex grow flex-col sm:p-0">
          <OrganizationProfileGrid profile={organization} />
        </TabsContent>
        <TabsContent value="relationships" className="grow">
          <ProfileOrganizations>
            <ProfileRelationshipsSuspense
              slug={profile.slug}
              showBreadcrumb={false}
            />
          </ProfileOrganizations>
        </TabsContent>
        <FollowersTabPanel className="px-0 sm:px-0">
          <ProfileFollowers profileId={profile.id} />
        </FollowersTabPanel>
        <DecisionsTabPanel>
          <ProfileDecisionsSuspense profileId={profile.id} />
        </DecisionsTabPanel>
        <MembersTabPanel profileId={profile.id} className="px-0 sm:px-0" />
      </ProfileColumn>
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
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

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

      <TabsContent value="about" className="sm:p-0">
        <ProfileGrid profile={userProfile} />
      </TabsContent>
      <TabsContent value="organizations" className="px-4 sm:px-6 sm:py-0">
        <ProfileOrganizations>
          <ProfileOrganizationsSuspense
            slug={profile.slug}
            showBreadcrumb={false}
          />
        </ProfileOrganizations>
      </TabsContent>
      <TabsContent value="following" className="px-4 sm:px-6 sm:py-0">
        <ProfileFollowing profileId={profile.id} />
      </TabsContent>
    </ProfileTabs>
  );
};
