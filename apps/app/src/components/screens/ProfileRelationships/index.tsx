'use client';

import { pluralize } from '@/utils/pluralize';
import { skipBatch, trpc } from '@op/api/client';
import { RELATIONSHIP_OPTIONS, relationshipMap } from '@op/types/relationships';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import React, { Suspense, useMemo, useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import {
  RelationshipList,
  type RelationshipListItem,
} from '@/components/RelationshipList';

import {
  OrganizationNameSuspense,
  ProfileOrganizations,
} from '../ProfileOrganizations';

export const ProfileRelationshipsSuspense = ({
  slug,
  showBreadcrumb = true,
}: {
  slug: string;
  showBreadcrumb?: boolean;
}) => {
  const [searchTerm] = useState('');
  const t = useTranslations();
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const [{ organizations, count }] =
    trpc.organization.listRelationships.useSuspenseQuery(
      {
        organizationId: organization.id,
      },
      {
        ...skipBatch,
      },
    );

  // Convert organization data to RelationshipListItem format
  const relationshipItems: RelationshipListItem[] = useMemo(
    () =>
      organizations.map((org) => ({
        id: org.id,
        name: org.profile.name,
        slug: org.profile.slug,
        bio: org.profile.bio,
        avatarImage: org.profile.avatarImage
          ? {
              id: org.profile.avatarImage.id,
              name: org.profile.avatarImage.name,
            }
          : null,
        type: 'org', // Organizations are always type 'org'
        relationships: org.relationships?.map((rel) => ({
          relationshipType: rel.relationshipType,
          pending: rel.pending,
        })),
      })),
    [organizations],
  );

  const relationshipsSegmented: Array<[string, Array<RelationshipListItem>]> =
    useMemo(
      () =>
        RELATIONSHIP_OPTIONS.map((definition) => [
          definition.noun,
          relationshipItems.filter((item) =>
            item.relationships?.some(
              (relationship) =>
                relationship.relationshipType === definition.key,
            ),
          ),
        ]),
      [relationshipItems],
    );

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        {showBreadcrumb ? (
          <Breadcrumbs className="hidden sm:flex">
            <Breadcrumb href={`/org/${slug}`}>
              {organization.profile.name}
            </Breadcrumb>
            <Breadcrumb>{t('Relationships')}</Breadcrumb>
          </Breadcrumbs>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="w-full font-serif text-title-sm sm:text-title-lg">
            {count} {pluralize(t('relationship'), count)}
          </div>
          <div className="w-72"></div>
        </div>
      </div>

      <Tabs>
        <TabList className="px-4 sm:px-0" variant="pill">
          <Tab id="all" variant="pill">
            {t('All relationships')}
          </Tab>
          {relationshipsSegmented.map(([noun, items]) =>
            items?.length ? (
              <Tab id={noun} key={noun} variant="pill">
                {noun}s
              </Tab>
            ) : null,
          )}
        </TabList>

        <TabPanel id="all" className="px-4 sm:px-0">
          <RelationshipList
            profiles={relationshipItems}
            searchTerm={searchTerm}
            relationshipMap={relationshipMap}
          />
        </TabPanel>

        {relationshipsSegmented.map(([noun, items]) =>
          items?.length ? (
            <TabPanel id={noun} key={noun} className="px-4 sm:px-0">
              <RelationshipList
                profiles={items}
                searchTerm={searchTerm}
                relationshipMap={relationshipMap}
              />
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
              <LuArrowLeft className="size-6 text-neutral-black" />
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
