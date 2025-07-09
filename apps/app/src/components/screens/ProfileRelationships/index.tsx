'use client';

import { pluralize } from '@/utils/pluralize';
import { RouterOutput, trpc } from '@op/api/client';
import { RELATIONSHIP_OPTIONS, relationshipMap } from '@op/types/relationships';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import React, { Suspense, useMemo, useState } from 'react';
import { LuArrowLeft, LuSearch } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import { ProfileRelationshipsSkeleton } from './Skeleton';

type relationshipOrganization =
  RouterOutput['organization']['listRelationships']['organizations'][number];

const RelationshipList = ({
  organizations,
  searchTerm,
}: {
  organizations: Array<relationshipOrganization>;
  searchTerm?: string;
}) => {
  const filteredOrganizations = useMemo(() => {
    if (!searchTerm) return organizations;
    
    return organizations.filter((org) =>
      org.profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.profile.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.relationships?.some((rel) =>
        relationshipMap[rel.relationshipType]?.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [organizations, searchTerm]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 pb-6">
      {filteredOrganizations.map((relationshipOrg) => (
        <div key={relationshipOrg.id} className="flex w-full gap-4 rounded-lg border border-neutral-gray1 p-4">
          <div className="flex-shrink-0">
            <OrganizationAvatar organization={relationshipOrg} className="size-12" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Link
                  className="font-semibold text-neutral-black hover:text-neutral-charcoal truncate"
                  href={`/org/${relationshipOrg.profile.slug}`}
                >
                  {relationshipOrg.profile.name}
                </Link>
                <div className="text-sm text-neutral-charcoal">
                  {relationshipOrg.relationships?.map((relationship, i, arr) => (
                    <React.Fragment key={relationship.id}>
                      {relationshipMap[relationship.relationshipType]?.label ?? 'Relationship'}
                      {relationship.pending && (
                        <TagGroup className="inline-flex ml-1">
                          <Tag className="rounded-sm px-1 py-0.5 text-xs">
                            Pending
                          </Tag>
                        </TagGroup>
                      )}
                      {i < arr.length - 1 && <span className="mx-1">•</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="text-sm text-neutral-charcoal line-clamp-3">
                {relationshipOrg.profile.bio &&
                relationshipOrg.profile.bio.length > 200
                  ? `${relationshipOrg.profile.bio.slice(0, 200)}...`
                  : relationshipOrg.profile.bio}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProfileRelationshipsSuspense = ({ slug }: { slug: string }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const [{ organizations, count }] =
    trpc.organization.listRelationships.useSuspenseQuery({
      organizationId: organization.id,
    });

  const relationshipsSegmented: Array<
    [string, Array<relationshipOrganization>]
  > = useMemo(
    () =>
      RELATIONSHIP_OPTIONS.map((definition) => [
        definition.noun,
        organizations.filter((org) =>
          org.relationships?.some(
            (relationship) => relationship.relationshipType === definition.key,
          ),
        ),
      ]),
    [organizations],
  );

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        <Breadcrumbs className="hidden sm:flex">
          <Breadcrumb href={`/org/${slug}`}>
            {organization.profile.name}
          </Breadcrumb>
          <Breadcrumb>Relationships</Breadcrumb>
        </Breadcrumbs>
        <div className="flex items-center justify-between">
          <div className="font-serif text-title-sm sm:text-title-lg">
            {count} {pluralize('Relationship', count)}
          </div>
          <div className="w-72">
            
          </div>
        </div>
      </div>
      <Tabs>
        <TabList className="px-4 sm:px-0">
          <Tab id="all">All relationships</Tab>
          {relationshipsSegmented.map(([noun, orgs]) =>
            orgs?.length ? <Tab id={noun} key={noun}>{noun}s</Tab> : null,
          )}
        </TabList>

        <TabPanel id="all" className="px-4 sm:px-0">
          <RelationshipList organizations={organizations} searchTerm={searchTerm} />
        </TabPanel>

        {relationshipsSegmented.map(([noun, orgs]) =>
          orgs?.length ? (
            <TabPanel id={noun} key={noun} className="px-4 sm:px-0">
              <RelationshipList organizations={orgs} searchTerm={searchTerm} />
            </TabPanel>
          ) : null,
        )}
      </Tabs>
    </>
  );
};

const OrganizationNameSuspense = ({ slug }: { slug: string }) => {
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

export const ProfileRelationshipsComponent = ({ slug }: { slug: string }) => (
  <div className="flex w-full flex-col gap-3 pt-4 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:pt-8">
    <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
      <Suspense fallback={<ProfileRelationshipsSkeleton />}>
        <ProfileRelationshipsSuspense slug={slug} />
      </Suspense>
    </ErrorBoundary>
  </div>
);

export const ProfileRelationships = ({ slug }: { slug: string }) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute left-0 top-0 z-50 w-full bg-white px-4 py-3 sm:hidden">
        <ErrorBoundary
          errorComponent={() => (
            <Link href="/" className="flex items-center gap-2">
              <LuArrowLeft className="size-6 stroke-1 text-neutral-black" />
            </Link>
          )}
        >
          <Suspense fallback={null}>
            <OrganizationNameSuspense slug={slug} />
          </Suspense>
        </ErrorBoundary>
      </header>
      <ProfileRelationshipsComponent slug={slug} />
    </>
  );
};
