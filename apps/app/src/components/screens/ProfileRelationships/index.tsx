'use client';

import { relationshipMap } from '@/utils/relationships';
import { RouterOutput, trpc } from '@op/api/client';
import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import React, { Suspense } from 'react';
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
    <ul className="flex flex-col gap-12">
      {organizations.map((relationshipOrg) => (
        <li className="flex w-full gap-6">
          <div>
            <OrganizationAvatar organization={relationshipOrg} />
          </div>
          <div>
            <Link
              className="flex flex-col gap-3 text-neutral-black"
              href={`/org/${relationshipOrg.slug}`}
            >
              <div className="flex flex-col gap-2">
                <div className="h-4 font-semibold">{relationshipOrg.name}</div>
                <div className="flex items-center gap-1">
                  {relationshipOrg.relationships?.map(
                    (relationship, i, arr) => (
                      <>
                        <div className="flex items-center gap-1">
                          {relationshipMap[relationship.relationshipType]
                            ?.label ?? 'Relationship'}{' '}
                          {relationship.pending ? (
                            <TagGroup>
                              <Tag className="rounded-sm p-1 text-xs">
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
                {relationshipOrg.bio}
              </div>
            </Link>
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

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        <Breadcrumbs>
          <Breadcrumb href={`/org/${slug}`}>{organization.name}</Breadcrumb>
          <Breadcrumb>Relationships</Breadcrumb>
        </Breadcrumbs>
        <div className="font-serif text-title-lg">{count} relationships</div>
      </div>
      <Tabs>
        <TabList className="px-4 sm:px-0">
          <Tab id="all">All relationships</Tab>
        </TabList>

        <TabPanel id="all" className="sm:px-0">
          <RelationshipList organizations={organizations} />
        </TabPanel>
      </Tabs>
    </>
  );
};

export const ProfileRelationships = ({ slug }: { slug: string }) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute left-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="flex w-full flex-col gap-3 pt-8 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4">
        <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
          <Suspense fallback={<ProfileRelationshipsSkeleton />}>
            <ProfileRelationshipsSuspense slug={slug} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
};
