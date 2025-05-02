import { getPublicUrl } from '@/utils';
import { trpc } from '@op/trpc/client';
import { Header1, Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';

export const LandingScreen = () => {
  const [organizations] = trpc.organization.list.useSuspenseQuery();
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();

  console.log('USER', user);

  return (
    <div className="container flex min-h-0 grow flex-col gap-8 pt-14">
      <div className="flex flex-col gap-6">
        <Header1 className="text-center">Welcome back, {user.name}!</Header1>
        <span className="text-center text-neutral-charcoal">
          Explore new connections and strengthen existing relationships.
        </span>
      </div>
      <Surface>hello</Surface>
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
                  <div className="w-60 overflow-hidden rounded-md" key={org.id}>
                    <Link href={`/org/${org.slug}`}>
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
  );
};

export const LandingScreenSkeleton: React.FC = () => {
  return (
    <div className="container flex min-h-0 grow flex-col gap-8 pt-14">
      <div className="flex flex-col gap-6">
        <Skeleton className="mx-auto h-10 w-1/2" />
        <SkeletonLine className="mx-auto h-5 w-2/3" />
      </div>
      <div>
        <div className="mb-8 flex justify-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex flex-col gap-8">
          <SkeletonLine className="mb-4 h-7 w-48" />
          <div className="grid grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex w-60 flex-col gap-3 overflow-hidden rounded-md border border-gray-200 bg-white p-3"
              >
                <Skeleton className="mb-3 h-32 w-full" />
                <Skeleton className="mx-auto mb-3 h-12 w-12 rounded-full" />
                <SkeletonLine className="mx-auto mb-2 h-6 w-32" />
                <SkeletonLine className="mx-auto h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
