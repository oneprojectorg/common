import { getPublicUrl } from '@/utils';
import { handleServerError } from '@/utils/handleServerError';
import { cn } from '@op/sense/lib/utils';
import { getGradientForString } from '@op/styles/constants';
import Image from 'next/image';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

import {
  IndividualProfileTabsRenderer,
  ProfileTabsRenderer,
} from './ProfileTabsRenderer';
import { fetchOrganizationBySlug, fetchProfileBySlug } from './cachedFetches';

const ProfileWithData = async ({
  slug,
  initialTab,
}: {
  slug: string;
  initialTab?: string;
}) => {
  try {
    // Fire profile + organization in parallel. The org lookup throws
    // NotFoundError for user-profile slugs; swallow it to null and gate
    // on profile.type below. profile.getBySlug is the source of truth for
    // whether the slug is an org — the org fetch is only consumed when it is.
    const [profile, organization] = await Promise.all([
      fetchProfileBySlug(slug),
      fetchOrganizationBySlug(slug).catch(() => null),
    ]);

    const { headerImage, avatarImage } = profile;
    const headerUrl = getPublicUrl(headerImage?.name);
    const avatarUrl = getPublicUrl(avatarImage?.name);

    const gradientBg = getGradientForString(profile.name || 'Common');
    const gradientBgHeader = getGradientForString(
      profile.name + 'C' || 'Common',
    );

    if (profile.type === 'org') {
      return organization ? (
        <>
          <ImageHeader
            headerImage={
              headerUrl ? (
                <Image src={headerUrl} alt="" fill className="object-cover" />
              ) : (
                <div className={cn('h-full w-full', gradientBgHeader)} />
              )
            }
            avatarImage={
              avatarUrl ? (
                <Image src={avatarUrl} alt="" fill className="object-cover" />
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
              <Image src={headerUrl} alt="" fill className="object-cover" />
            ) : (
              <div className={cn('h-full w-full', gradientBgHeader)} />
            )
          }
          avatarImage={
            avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
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
  } catch (error) {
    // A missing/forbidden profile becomes a 404/403; anything else is a
    // genuine failure and should surface as a 500 rather than a misleading 404.
    handleServerError(error);
  }
};

export const Profile = ({
  slug,
  initialTab,
}: {
  slug: string;
  initialTab?: string;
}) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute start-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-background rtl:-scale-x-100" />
        </Link>
      </header>
      <div className="-mt-[3.05rem] flex w-full flex-col gap-3 border-offWhite border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border sm:border-offWhite">
        <ProfileWithData slug={slug} initialTab={initialTab} />
      </div>
    </>
  );
};
