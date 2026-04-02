 'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type {
  Organization as OrganizationEntity,
  Profile as ProfileEntity,
} from '@op/api/encoders';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileBodyClient } from './ProfileBodyClient';

const ProfileLayout = ({
  initialTab,
  profile,
  profileEntity,
}: {
  initialTab?: string;
  profile: ProfileEntity;
  profileEntity: OrganizationEntity;
}) => {
  const { headerImage, avatarImage } = profile;
  const headerUrl = getPublicUrl(headerImage?.name);
  const avatarUrl = getPublicUrl(avatarImage?.name);

  const gradientBg = getGradientForString(profile.name || 'Common');
  const gradientBgHeader = getGradientForString(profile.name + 'C' || 'Common');

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
      <ProfileBodyClient
        profile={profile}
        profileEntity={profileEntity}
        initialTab={initialTab}
      />
    </>
  );
};

const OrganizationProfile = ({
  initialTab,
  profile,
}: {
  initialTab?: string;
  profile: ProfileEntity;
}) => {
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug: profile.slug,
  });

  if (!organization) {
    notFound();
  }

  return (
    <ProfileLayout
      initialTab={initialTab}
      profile={profile}
      profileEntity={organization}
    />
  );
};

const IndividualProfile = ({
  initialTab,
  profile,
}: {
  initialTab?: string;
  profile: ProfileEntity;
}) => {
  const userProfile = {
    id: profile.id,
    profile,
    acceptingApplications: false,
    links: [],
    networkOrganization: null,
    isOfferingFunds: false,
    isReceivingFunds: false,
    projects: [],
    whereWeWork: [],
    strategies: [],
    receivingFundsTerms: [],
    orgType: '',
    domain: null,
  } satisfies OrganizationEntity;

  return (
    <ProfileLayout
      initialTab={initialTab}
      profile={profile}
      profileEntity={userProfile}
    />
  );
};

export const Profile = ({
  slug,
  initialTab,
}: {
  slug: string;
  initialTab?: string;
}) => {
  const [profile] = trpc.profile.getBySlug.useSuspenseQuery({
    slug,
  });

  if (!profile) {
    notFound();
  }

  return (
    <>
      {/* nav arrow */}
      <header className="absolute top-0 left-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="-mt-[3.05rem] flex w-full flex-col gap-3 border-offWhite border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border sm:border-offWhite">
        {profile.type === 'org' ? (
          <OrganizationProfile profile={profile} initialTab={initialTab} />
        ) : (
          <IndividualProfile profile={profile} initialTab={initialTab} />
        )}
      </div>
    </>
  );
};
