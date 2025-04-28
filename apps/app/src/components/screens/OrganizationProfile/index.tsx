'use client';

import { getPublicUrl } from '@/utils';
import { AuthWrapper } from '@/utils/AuthWrapper';
import { trpc } from '@op/trpc/client';
import { Button } from '@op/ui/Button';
import { Modal } from '@op/ui/Modal';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';

import { Header1 } from '@/components/Header';
import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';
import { ProfileTabs } from '@/components/Profile/ProfileTabs';

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
      <ProfileTabs profile={organization} />
    </>
  );
};

export const OrganizationProfile = ({ slug }: { slug: string }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = searchParams.get('new');
  const [modalOpen, setModalOpen] = React.useState(!!isNew);

  React.useEffect(() => {
    setModalOpen(!!isNew);
  }, [isNew]);

  const handleModalChange = (open: boolean) => {
    setModalOpen(open);

    if (!open && isNew) {
      // Remove 'new' param from URL
      const params = new URLSearchParams(window.location.search);

      params.delete('new');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

      router.replace(newUrl);
    }
  };

  return (
    <AuthWrapper>
      <div className="flex w-full flex-col gap-3 outline outline-1 -outline-offset-1 outline-offWhite">
        <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationProfileSuspense slug={slug} />
            <Modal
              className="inset-shadow-none shadow-green"
              isOpen={modalOpen}
              onOpenChange={handleModalChange}
            >
              <div className="p-12 text-center">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <svg
                      width="64"
                      height="65"
                      viewBox="0 0 64 65"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M31.9997 59.1668C46.7273 59.1668 58.6663 47.2278 58.6663 32.5002C58.6663 17.7726 46.7273 5.8335 31.9997 5.8335C17.2721 5.8335 5.33301 17.7726 5.33301 32.5002C5.33301 47.2278 17.2721 59.1668 31.9997 59.1668Z"
                        fill="#D8F3CC"
                      />
                      <path
                        d="M20 32.5L28 40.5L44 24.5"
                        stroke="#3EC300"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex flex-col gap-2">
                      <Header1>You're all set!</Header1>
                      You've successfully joined Common. Your organization's
                      profile is now visible to aligned collaborators and
                      funders.
                    </div>
                  </div>
                  <Button onPress={() => handleModalChange(false)}>
                    Take me to Common
                  </Button>
                </div>
              </div>
            </Modal>
          </Suspense>
        </ErrorBoundary>
      </div>
    </AuthWrapper>
  );
};
