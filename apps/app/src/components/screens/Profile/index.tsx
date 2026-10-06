import { getPublicUrl } from '@/utils';
import type { RouterOutput } from '@op/api/client';
import { cn } from '@op/sense/lib/utils';
import { getGradientForString } from '@op/styles/constants';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

import {
  IndividualProfileTabsRenderer,
  ProfileTabsRenderer,
} from './ProfileTabsRenderer';

interface ProfileData {
  profile: RouterOutput['profile']['getBySlug'];
  organization: RouterOutput['organization']['getBySlug'] | null;
}

export const Profile = ({
  profile,
  organization,
  initialTab,
}: ProfileData & {
  initialTab?: string;
}) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute start-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-white rtl:-scale-x-100" />
        </Link>
      </header>
      <div className="-mt-[3.05rem] flex w-full flex-col gap-3 border-border border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border sm:border-border">
        <ProfileWithData
          profile={profile}
          organization={organization}
          initialTab={initialTab}
        />
      </div>
    </>
  );
};

/** Fills its positioned parent, as the header and avatar slots expect. */
const CoverImage = ({ src }: { src: string }) => (
  <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
);

const ProfileWithData = ({
  profile,
  organization,
  initialTab,
}: ProfileData & {
  initialTab?: string;
}) => {
  const { headerImage, avatarImage } = profile;
  const headerUrl = getPublicUrl(headerImage?.name);
  const avatarUrl = getPublicUrl(avatarImage?.name);

  const gradientBg = getGradientForString(profile.name || 'Common');
  const gradientBgHeader = getGradientForString(profile.name + 'C' || 'Common');

  if (profile.type === 'org') {
    return organization ? (
      <>
        <ImageHeader
          headerImage={
            headerUrl ? (
              <CoverImage src={headerUrl} />
            ) : (
              <div className={cn('h-full w-full', gradientBgHeader)} />
            )
          }
          avatarImage={
            avatarUrl ? (
              <CoverImage src={avatarUrl} />
            ) : (
              <div className={cn('h-full w-full', gradientBg)} />
            )
          }
        />

        <ProfileDetails organization={organization} />
        <ProfileTabsRenderer
          organization={organization}
          profile={profile}
          initialTab={initialTab}
        />
      </>
    ) : null;
  }

  // For user profiles, create a simplified profile object based on the profile data
  // TODO: this is jammed in until we update the individual profile and a better typing
  const userProfile = {
    id: profile.id,
    profile,
    // Add minimal required properties for existing components
    links: [],
    networkOrganization: null,
    isOfferingFunds: false,
    isReceivingFunds: false,
    projects: [],
    posts: [],
    terms: [],
    whereWeWork: [],
    strategies: [],
    receivingFundsTerms: [],
    orgType: '',
    domain: null,
    isVerified: false,
    relationshipCounts: {
      partners: 0,
      funders: 0,
      fundees: 0,
      collaborators: 0,
    },
  };

  return (
    <>
      <ImageHeader
        headerImage={
          headerUrl ? (
            <CoverImage src={headerUrl} />
          ) : (
            <div className={cn('h-full w-full', gradientBgHeader)} />
          )
        }
        avatarImage={
          avatarUrl ? (
            <CoverImage src={avatarUrl} />
          ) : (
            <div className={cn('h-full w-full', gradientBg)} />
          )
        }
      />

      <ProfileDetails organization={userProfile} />
      <IndividualProfileTabsRenderer
        userProfile={userProfile}
        profile={profile}
        initialTab={initialTab}
      />
    </>
  );
};
