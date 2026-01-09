'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import { type ReactNode, Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ErrorMessage } from '@/components/ErrorMessage';
import { OrganizationAvatar } from '@/components/OrganizationAvatar';
import { OrganizationCardList } from '@/components/OrganizationList';
import { RelationshipTabSkeleton } from '@/components/skeletons/RelationshipTabSkeleton';

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
      <div className="gap-4 sm:px-0 flex flex-col">
        {showBreadcrumb ? (
          <Breadcrumbs className="sm:flex hidden">
            <Breadcrumb href={`/org/${slug}`}>{profile.name}</Breadcrumb>
            <Breadcrumb>Organizations</Breadcrumb>
          </Breadcrumbs>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="sm:text-title-lg font-serif text-title-sm">
            Member of {organizations.length}{' '}
            {pluralize('Organization', organizations.length)}
          </div>
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
      className="gap-2 flex items-center"
    >
      <LuArrowLeft className="size-6 text-neutral-black" />
      <div className="gap-1 font-semibold flex items-center text-sm text-neutral-black">
        <OrganizationAvatar profile={organization.profile} className="size-6" />
        {organization.profile.name}
      </div>
    </Link>
  );
};

export const ProfileOrganizations = ({ children }: { children: ReactNode }) => (
  <div className="gap-3 pt-4 sm:min-h-[calc(100vh-3.5rem)] sm:gap-8 sm:pt-8 flex w-full flex-col">
    <ErrorBoundary errorComponent={() => <ErrorMessage />}>
      <Suspense fallback={<RelationshipTabSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  </div>
);
