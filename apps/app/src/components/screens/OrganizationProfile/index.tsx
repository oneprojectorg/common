'use client';

import { getPublicUrl } from '@/utils';
import { AuthWrapper } from '@/utils/AuthWrapper';
import { trpc } from '@op/trpc/client';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import Image from 'next/image';
import React, { Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileGrid, ProfileTabs } from '@/components/Profile/ProfileContent';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

const OrganizationProfileSuspense = ({ slug }: { slug: string }) => {
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const { headerImage, avatarImage } = organization;
  const headerUrl = getPublicUrl(headerImage?.name);
  const avatarUrl = getPublicUrl(avatarImage?.name);

  return (
    <>
      <ImageHeader
        headerImage={
          headerUrl ? (
            <Image src={headerUrl} alt="" fill className="object-cover" />
          ) : null
        }
        avatarImage={
          avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" />
          ) : null
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
    <AuthWrapper>
      {/* nav arrow */}
      <header className="absolute left-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="flex w-full flex-col gap-3 border border-offWhite border-b-transparent sm:min-h-[calc(100vh-3.5rem)] sm:gap-4">
        <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationProfileSuspense slug={slug} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AuthWrapper>
  );
};
