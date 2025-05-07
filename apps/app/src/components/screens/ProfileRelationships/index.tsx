'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/trpc/client';
import { Avatar } from '@op/ui/Avatar';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import Image from 'next/image';
import React, { Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

const ProfileRelationshipsSuspense = ({ slug }: { slug: string }) => {
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const [{ relationships, count }] =
    trpc.organization.listRelationships.useSuspenseQuery({
      from: organization.id,
    });

  return (
    <>
      <div className="font-serif text-title-lg">{count} relationships</div>
      <Tabs>
        <TabList className="px-4">
          <Tab id="all">All relationships</Tab>
        </TabList>

        <TabPanel id="all" className="px-6">
          <ul className="flex flex-col gap-12">
            {relationships.map((relationship) => (
              <li className="flex w-full gap-6">
                <div>
                  <Avatar className="size-12">
                    {
                      // @ts-expect-error
                      relationship.targetOrganization.name ? (
                        <Image
                          src={
                            getPublicUrl(
                              // @ts-expect-error
                              relationship.targetOrganization.avatarImage?.name,
                            ) ?? ''
                          }
                          width={80}
                          height={80}
                          alt={
                            // @ts-expect-error
                            relationship.targetOrganization.name
                          }
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center text-neutral-gray3">
                          {
                            // @ts-expect-error
                            relationship.targetOrganization.name?.slice(0, 1) ??
                              ''
                          }
                        </div>
                      )
                    }
                  </Avatar>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="font-semibold">
                    {
                      // @ts-expect-error
                      relationship.targetOrganization.name
                    }
                  </div>
                  <div className="flex items-center gap-1">
                    {relationship.relationshipType}{' '}
                    {relationship.pending ? (
                      <TagGroup>
                        <Tag className="rounded-sm p-1">Pending</Tag>
                      </TagGroup>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
      <div className="flex w-full flex-col gap-3 border border-offWhite border-b-transparent sm:min-h-[calc(100vh-3.5rem)] sm:gap-4">
        <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <ProfileRelationshipsSuspense slug={slug} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
};
