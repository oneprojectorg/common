'use client';

import { getPublicUrl } from '@/utils';
import { AuthWrapper } from '@/utils/AuthWrapper';
import { trpc } from '@op/trpc/client';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import Image from 'next/image';
import Link from 'next/link';

import { Header1, Header3 } from '@/components/Header';
import { ImageHeader } from '@/components/ImageHeader';

const MainPage = () => {
  const { data: organizations } = trpc.organization.list.useQuery();

  return (
    <AuthWrapper>
      <div className="container flex min-h-0 grow flex-col gap-8 pt-14">
        <div className="flex flex-col gap-6">
          <Header1 className="text-center">Welcome back!</Header1>
          <span className="text-center">
            <span className="font-bold">12 new organizations</span> have joined
            Common this week. Find your collaborators to get started.{' '}
          </span>
        </div>
        <Tabs>
          <TabList>
            <Tab id="discover">Discover</Tab>
            <Tab id="recent">Recent</Tab>
          </TabList>

          <TabPanel id="discover" className="px-0">
            <div className="flex flex-col gap-8">
              <Header3 className="font-serif">New Organizations</Header3>
              <div className="grid grid-cols-3 gap-8">
                {organizations?.map((org) => {
                  const { headerImage, avatarImage } = org;
                  const headerUrl = getPublicUrl(headerImage?.name);
                  const avatarUrl = getPublicUrl(avatarImage?.name);

                  return (
                    <div
                      className="w-60 overflow-hidden rounded-md"
                      key={org.id}
                    >
                      <Link href={`/app/org/${org.slug}`}>
                        <ImageHeader
                          headerClassName="h-32 "
                          headerImage={
                            headerUrl ? (
                              <Image
                                src={headerUrl}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            ) : null
                          }
                          avatarImage={
                            avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            ) : null
                          }
                        />
                        <div className="flex flex-col gap-3">
                          <Header3>{org.name}</Header3>
                          <p className="text-charcoal">{org.city}</p>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabPanel>
          <TabPanel id="recent">Nothing here yet</TabPanel>
        </Tabs>
      </div>
    </AuthWrapper>
  );
};

export default MainPage;
