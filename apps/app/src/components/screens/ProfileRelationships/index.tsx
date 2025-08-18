'use client';

import { pluralize } from '@/utils/pluralize';
import { RouterOutput, trpc } from '@op/api/client';
import { RELATIONSHIP_OPTIONS, relationshipMap } from '@op/types/relationships';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import React, { Suspense, useMemo, useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import {
  OrganizationNameSuspense,
  ProfileOrganizations,
} from '../ProfileOrganizations';

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

    return organizations.filter(
      (org) =>
        org.profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.profile.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.relationships?.some((rel) =>
          relationshipMap[rel.relationshipType]?.label
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        ),
    );
  }, [organizations, searchTerm]);

  return (
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {filteredOrganizations.map((relationshipOrg) => (
        <div
          key={relationshipOrg.id}
          className="flex w-full gap-4 rounded border border-neutral-gray1 p-6"
        >
          <div className="flex-shrink-0">
            <OrganizationAvatar
              profile={relationshipOrg.profile}
              className="size-20"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Link
                  className="truncate font-semibold text-neutral-black"
                  href={`/org/${relationshipOrg.profile.slug}`}
                >
                  {relationshipOrg.profile.name}
                </Link>
                <div className="text-neutral-black">
                  {relationshipOrg.relationships?.map(
                    (relationship, i, arr) => (
                      <React.Fragment key={relationship.relationshipType}>
                        {relationshipMap[relationship.relationshipType]
                          ?.label ?? 'Relationship'}
                        {relationship.pending && (
                          <TagGroup className="ml-1 inline-flex">
                            <Tag className="rounded-sm px-1 py-0.5 text-xs">
                              Pending
                            </Tag>
                          </TagGroup>
                        )}
                        {i < arr.length - 1 && <span className="mx-1">•</span>}
                      </React.Fragment>
                    ),
                  )}
                </div>
              </div>

              <div className="line-clamp-3 text-neutral-charcoal">
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

export const ProfileRelationshipsSuspense = ({
  slug,
  showBreadcrumb = true,
}: {
  slug: string;
  showBreadcrumb?: boolean;
}) => {
  const [searchTerm] = useState('');
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
        {showBreadcrumb ? (
          <Breadcrumbs className="hidden sm:flex">
            <Breadcrumb href={`/org/${slug}`}>
              {organization.profile.name}
            </Breadcrumb>
            <Breadcrumb>Relationships</Breadcrumb>
          </Breadcrumbs>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="w-full font-serif text-title-sm sm:text-title-lg">
            {count} {pluralize('Relationship', count)}
          </div>
          <div className="w-72"></div>
        </div>
      </div>
      <Tabs>
        <TabList className="px-4 sm:px-0" variant="pill">
          <Tab id="all" variant="pill">
            All relationships
          </Tab>
          {relationshipsSegmented.map(([noun, orgs]) =>
            orgs?.length ? (
              <Tab id={noun} key={noun} variant="pill">
                {noun}s
              </Tab>
            ) : null,
          )}
        </TabList>

        <TabPanel id="all" className="px-4 sm:px-0">
          <RelationshipList
            organizations={organizations}
            searchTerm={searchTerm}
          />
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
      <ProfileOrganizations>
        <ProfileRelationshipsSuspense slug={slug} />
      </ProfileOrganizations>
    </>
  );
};
