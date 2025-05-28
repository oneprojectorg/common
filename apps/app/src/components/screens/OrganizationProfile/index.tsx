import { getPublicUrl } from '@/utils';
import { trpcNext } from '@op/api/vanilla';
import { Skeleton } from '@op/ui/Skeleton';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';
import React, { Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileGrid, ProfileTabs } from '@/components/Profile/ProfileContent';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

const OrganizationProfileSuspense = async ({ slug }: { slug: string }) => {
  const client = await trpcNext();
  const organization = await client.organization.getBySlug.query({
    slug,
  });

  const { headerImage, avatarImage } = organization;
  const headerUrl = getPublicUrl(headerImage?.name);
  const avatarUrl = getPublicUrl(avatarImage?.name);

  const gradientBg = getGradientForString(organization.name || 'Common');
  const gradientBgHeader = getGradientForString(
    organization.name + 'C' || 'Common',
  );

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

      <ProfileDetails profile={organization} />
      <ProfileGrid profile={organization} />
      <ProfileTabs profile={organization} />
    </>
  );
};

export const OrganizationProfile = ({ slug }: { slug: string }) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute left-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="-mt-12 flex w-full flex-col gap-3 border-offWhite border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <OrganizationProfileSuspense slug={slug} />
        </Suspense>
      </div>
    </>
  );
};
