import { getPublicUrl } from '@/utils';
import { trpcNext } from '@op/api/vanilla';
import { Tab, TabPanel } from '@op/ui/Tabs';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import {
  OrganizationProfileGrid,
  ProfileGrid,
  ProfileTabList,
  ProfileTabs,
  ProfileTabsMobile,
} from '@/components/Profile/ProfileContent';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

import {
  ProfileOrganizations,
  ProfileOrganizationsSuspense,
} from '../ProfileOrganizations';
import { ProfileRelationshipsSuspense } from '../ProfileRelationships';

const ProfileWithData = async ({ slug }: { slug: string }) => {
  try {
    const client = await trpcNext();

    // First, get the profile data
    const profile = await client.profile.getBySlug.query({
      slug,
    });

    const { headerImage, avatarImage } = profile;
    const headerUrl = getPublicUrl(headerImage?.name);
    const avatarUrl = getPublicUrl(avatarImage?.name);

    const gradientBg = getGradientForString(profile.name || 'Common');
    const gradientBgHeader = getGradientForString(
      profile.name + 'C' || 'Common',
    );

    // If it's an organization profile, query organization-specific data separately
    if (profile.type === 'org') {
      const organization = await client.organization.getBySlug.query({
        slug,
      });

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

          <ProfileDetails profile={organization as any} />
          <ProfileTabs>
            <ProfileTabList>
              <Tab id="home">Home</Tab>
              <Tab id="relationships">Relationships</Tab>
            </ProfileTabList>

            <TabPanel id="home" className="sm:p-0">
              <OrganizationProfileGrid profile={organization} />
            </TabPanel>
            <TabPanel id="relationships" className="px-4 sm:px-6 sm:py-0">
              <ProfileOrganizations>
                <ProfileRelationshipsSuspense
                  slug={organization.profile.slug}
                  showBreadcrumb={false}
                />
              </ProfileOrganizations>
            </TabPanel>
          </ProfileTabs>
          <ProfileTabsMobile profile={organization as any} />
        </>
      );
    }

    // For user profiles, create a simplified profile object based on the profile data
    // TODO: this is jammed in until we update the individual profile and a better typing
    const userProfile = {
      id: profile.id,
      profile: {
        id: profile.id,
        name: profile.name,
        slug: profile.slug,
        bio: profile.bio,
        mission: profile.mission,
        email: profile.email,
        website: profile.website,
        city: profile.city,
        state: profile.state,
        avatarImage: profile.avatarImage,
        headerImage: profile.headerImage,
      },
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
      orgType: undefined,
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

        <ProfileDetails profile={userProfile as any} />
        <ProfileTabs>
          <ProfileTabList>
            <Tab id="about">About</Tab>
            <Tab id="organizations">Organizations</Tab>
          </ProfileTabList>

          <TabPanel id="about" className="sm:p-0">
            <ProfileGrid profile={userProfile as any} />
          </TabPanel>
          <TabPanel id="organizations" className="px-4 sm:px-6 sm:py-0">
            <ProfileOrganizations>
              <ProfileOrganizationsSuspense
                slug={userProfile.profile.slug}
                showBreadcrumb={false}
              />
            </ProfileOrganizations>
          </TabPanel>
        </ProfileTabs>
        <ProfileTabsMobile profile={userProfile as any} />
      </>
    );
  } catch (e) {
    console.error(e);
    notFound();
  }
};

export const Profile = ({ slug }: { slug: string }) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute left-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="-mt-[3.05rem] flex w-full flex-col gap-3 border-offWhite border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border">
        <ProfileWithData slug={slug} />
      </div>
    </>
  );
};
