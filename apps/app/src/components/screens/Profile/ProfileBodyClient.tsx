'use client';

import type { Organization, Profile } from '@op/api/encoders';

import { ProfileDetails } from '@/components/Profile/ProfileDetails';

import {
  IndividualProfileTabsRenderer,
  ProfileTabsRenderer,
} from './ProfileTabsRenderer';

interface ProfileBodyClientProps {
  initialTab?: string;
  profile: Profile;
  profileEntity: Organization;
}

export const ProfileBodyClient = ({
  initialTab,
  profile,
  profileEntity,
}: ProfileBodyClientProps) => {
  if (profile.type === 'org') {
    return (
      <>
        <ProfileDetails organization={profileEntity} />
        <ProfileTabsRenderer
          organization={profileEntity}
          profile={profile}
          initialTab={initialTab}
        />
      </>
    );
  }

  return (
    <>
      <ProfileDetails organization={profileEntity} />
      <IndividualProfileTabsRenderer
        userProfile={profileEntity}
        profile={profile}
        initialTab={initialTab}
      />
    </>
  );
};
