'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import { ReactNode, Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';
import { OrganizationCardList } from '@/components/OrganizationList';

import { ProfileRelationshipsSkeleton } from '../ProfileRelationships/Skeleton';

export const ProfileOrganizationsSuspense = ({
  slug,
  showBreadcrumb = false,
}: {
  slug: string;
  showBreadcrumb?: boolean;
}) => {
  // const [searchTerm] = useState('');
  const [profile] = trpc.profile.getBySlug.useSuspenseQuery({
    slug,
  });

  const [organizations] =
    trpc.organization.getOrganizationsByProfile.useSuspenseQuery({
      profileId: profile.id,
    });

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        {showBreadcrumb ? (
          <Breadcrumbs className="hidden sm:flex">
            <Breadcrumb href={`/org/${slug}`}>{profile.name}</Breadcrumb>
            <Breadcrumb>Organizations</Breadcrumb>
          </Breadcrumbs>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="font-serif text-title-sm sm:text-title-lg">
            Member of {organizations.length}{' '}
            {pluralize('Organization', organizations.length)}
          </div>
          <div className="w-72"></div>
        </div>
      </div>
      <OrganizationCardList organizations={organizations} />
    </>
  );
};

export const OrganizationNameSuspense = ({ slug }: { slug: string }) => {
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  return (
    <Link
      href={`/org/${organization.profile.slug}`}
      className="flex items-center gap-2"
    >
      <LuArrowLeft className="size-6 stroke-1 text-neutral-black" />
      <div className="flex items-center gap-1 text-sm font-semibold text-neutral-black">
        <OrganizationAvatar organization={organization} className="size-6" />
        {organization.profile.name}
      </div>
    </Link>
  );
};

export const ProfileOrganizations = ({ children }: { children: ReactNode }) => (
  <div className="flex w-full flex-col gap-3 pt-4 sm:min-h-[calc(100vh-3.5rem)] sm:gap-8 sm:pt-8">
    <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
      <Suspense fallback={<ProfileRelationshipsSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  </div>
);
