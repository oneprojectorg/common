'use client';

import { pluralize } from '@/utils/pluralize';
import { RELATIONSHIP_OPTIONS, relationshipMap } from '@op/types/relationships';
import { RouterOutput, trpc } from '@op/api/client';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import React, { Suspense, useMemo } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import { ProfileRelationshipsSkeleton } from './Skeleton';

type relationshipOrganization =
  RouterOutput['organization']['listRelationships']['organizations'][number];

const RelationshipList = ({
  organizations,
}: {
  organizations: Array<relationshipOrganization>;
}) => {
  return (
    <ul className="flex flex-col gap-12 pb-6">
      {organizations.map((relationshipOrg) => (
        <li className="flex w-full gap-6">
          <div>
            <OrganizationAvatar organization={relationshipOrg} />
          </div>
          <div>
            <div className="flex flex-col gap-3 text-neutral-black">
              <div className="flex flex-col gap-2">
                <Link
                  className="h-4 font-semibold"
                  href={`/org/${relationshipOrg.profile.slug}`}
                >
                  {relationshipOrg.profile.name}
                </Link>
                <div className="flex flex-wrap items-center gap-4 gap-x-1 gap-y-2">
                  {relationshipOrg.relationships?.map(
                    (relationship, i, arr) => (
                      <>
                        <div className="flex items-center gap-1">
                          {relationshipMap[relationship.relationshipType]
                            ?.label ?? 'Relationship'}{' '}
                          {relationship.pending ? (
                            <TagGroup>
                              <Tag className="rounded-sm p-1 text-xs sm:rounded-sm">
                                Pending
                              </Tag>
                            </TagGroup>
                          ) : null}
                        </div>
                        {i < arr.length - 1 && (
                          <span className="text-neutral-gray4">•</span>
                        )}
                      </>
                    ),
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 text-neutral-charcoal">
                {relationshipOrg.profile.bio &&
                relationshipOrg.profile.bio.length > 325
                  ? `${relationshipOrg.profile.bio.slice(0, 325)}...`
                  : relationshipOrg.profile.bio}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

const ProfileRelationshipsSuspense = ({ slug }: { slug: string }) => {
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
        <div className="font-serif text-title-sm sm:text-title-lg">
          {count} {pluralize('relationship', count)}
        </div>
      </div>
      <Tabs>
        <TabList className="px-4 sm:px-0">
          <Tab id="all">All relationships</Tab>
          {relationshipsSegmented.map(([noun, orgs]) =>
            orgs?.length ? <Tab id={noun}>{noun}s</Tab> : null,
          )}
        </TabList>

        <TabPanel id="all" className="px-4 sm:px-0">
          <RelationshipList organizations={organizations} />
        </TabPanel>

        {relationshipsSegmented.map(([noun, orgs]) =>
          orgs?.length ? (
            <TabPanel id={noun} className="px-4 sm:px-0">
              <RelationshipList organizations={orgs} />
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
      <div className="flex w-full flex-col gap-3 pt-4 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:pt-8">
        <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
          <Suspense fallback={<ProfileRelationshipsSkeleton />}>
            <ProfileRelationshipsSuspense slug={slug} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
};
