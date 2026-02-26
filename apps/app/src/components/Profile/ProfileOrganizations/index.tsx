'use client';

import { trpc } from '@op/api/client';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { OrganizationAvatarSkeleton } from '@/components/OrganizationAvatar';
import { OrganizationSummaryList } from '@/components/OrganizationList';

export const ProfileOrganizationsSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const t = useTranslations();
  const [organizations] =
    trpc.organization.getOrganizationsByProfile.useSuspenseQuery({
      profileId,
    });

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-neutral-gray4">
        <p>{t('No organizations found for this profile')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <OrganizationSummaryList organizations={organizations} />
    </div>
  );
};

const OrganizationSummarySkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index}>
          <div className="flex items-start gap-2 py-2 sm:gap-6">
            <OrganizationAvatarSkeleton className="size-8 sm:size-12" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <SkeletonLine
                lines={2}
                randomWidth={true}
                className="w-full max-w-md"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProfileOrganizationsErrorFallback = () => {
  const t = useTranslations();
  return <div>{t('Could not load organizations')}</div>;
};

export const ProfileOrganizations = ({ profileId }: { profileId: string }) => {
  return (
    <ErrorBoundary fallback={<ProfileOrganizationsErrorFallback />}>
      <Suspense fallback={<OrganizationSummarySkeleton />}>
        <ProfileOrganizationsSuspense profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
  );
};
