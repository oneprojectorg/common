'use client';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';
import { ProfileTabs } from '@/components/Profile/ProfileTabs';
import { getPublicUrl } from '@/utils';
import { AuthWrapper } from '@/utils/AuthWrapper';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import Image from 'next/image';
import { Suspense } from 'react';

import { trpc } from '@op/trpc/client';

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
          headerUrl
            ? (
                <Image src={headerUrl} alt="" fill className="object-cover" />
              )
            : null
        }
        avatarImage={
          avatarUrl
            ? (
                <Image src={avatarUrl} alt="" fill className="object-cover" />
              )
            : null
        }
      />

      <ProfileDetails profile={organization} />
      <ProfileTabs profile={organization} />
    </>
  );
};

export const OrganizationProfile = ({ slug }: { slug: string }) => {
  return (
    <AuthWrapper>
      <div className="flex w-full flex-col gap-3 outline outline-1 -outline-offset-1 outline-offWhite">
        <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationProfileSuspense slug={slug} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AuthWrapper>
  );
};
