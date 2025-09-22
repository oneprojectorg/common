import { getPublicUrl } from '@/utils';
import { checkModuleEnabled } from '@/utils/modules';
import { trpcNext } from '@op/api/vanilla';
import { match } from '@op/core';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

import {
  IndividualProfileTabsRenderer,
  ProfileTabsRenderer,
} from './ProfileTabsRenderer';

const ProfileWithData = async ({
  slug,
  initialTab,
}: {
  slug: string;
  initialTab?: string;
}) => {
  try {
    const client = await trpcNext();

    // First, get the profile data
    const profile = await client.profile.getBySlug.query({
      slug,
    });

    const schema = match(slug, {
      'people-powered': 'simple',
      cowop: 'cowop',
      'one-project': 'horizon',
      'd4cc2f9e-a461-4727-8b3a-3adae4f92a25': 'cowop',
      _: 'horizon',
    });

    console.log('Choosing schema:', schema);

    const { headerImage, avatarImage } = profile;
    const headerUrl = getPublicUrl(headerImage?.name);
    const avatarUrl = getPublicUrl(avatarImage?.name);

    const gradientBg = getGradientForString(profile.name || 'Common');
    const gradientBgHeader = getGradientForString(
      profile.name + 'C' || 'Common',
    );

    // If it's an organization profile, query organization-specific data separately
    if (profile.type === 'org') {
      // Get the org with profile attached
      const organization = await client.organization.getBySlug.query({
        slug,
      });

      const decisionsEnabled = checkModuleEnabled(
        organization.profile.modules,
        'decisions',
      );

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
            decisionsEnabled={decisionsEnabled}
            schema={schema}
          />
        </>
      ) : null;
    }

    // For user profiles, create a simplified profile object based on the profile data
    // TODO: this is jammed in until we update the individual profile and a better typing
    // Remove modules from individual profiles since they don't use decision tabs
    const { modules, ...profileWithoutModules } = profile;
    const userProfile = {
      id: profile.id,
      profile: {
        ...profileWithoutModules,
        modules: undefined, // Individual profiles don't need modules
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
  } catch (e) {
    console.error(e);
    notFound();
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
      <header className="absolute left-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="-mt-[3.05rem] flex w-full flex-col gap-3 border-offWhite border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border">
        <ProfileWithData slug={slug} initialTab={initialTab} />
      </div>
    </>
  );
};
