import { getPublicUrl } from '@/utils';
import { Organization } from '@op/api/encoders';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import {
  OrganizationAvatar,
  OrganizationAvatarSkeleton,
} from '@/components/OrganizationAvatar';
import {
  CarouselItem,
  OrganizationCarousel,
} from '@/components/OrganizationCarousel';

export const OrganizationList = ({
  organizations,
}: {
  organizations: Array<Organization>;
}) => {
  return (
    <>
      <div className="hidden flex-col gap-6 sm:flex">
        {organizations?.map((org) => {
          return (
            <div key={org.id}>
              <Link
                className="flex items-center gap-4"
                href={`/org/${org.slug}`}
              >
                <OrganizationAvatar organization={org} className="size-8" />

                <div className="flex flex-col text-sm">
                  <span>{org.name}</span>
                  <span>{org.city}</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* mobile */}
      <div className="flex flex-col gap-6 sm:hidden">
        <OrganizationCarousel label="New Organizations" itemWidth={192}>
          <>
            {organizations?.map((org) => {
              const { avatarImage, headerImage } = org;
              const avatarUrl = getPublicUrl(avatarImage?.name);
              const headerUrl = getPublicUrl(headerImage?.name);

              return (
                <CarouselItem key={org.id}>
                  <Surface className="flex size-48">
                    <Link
                      className="flex size-full flex-col gap-3"
                      href={`/org/${org.slug}`}
                    >
                      <ImageHeader
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

                      <div className="flex flex-col p-4 pt-0 text-left">
                        <span>{org.name}</span>
                        <span>
                          {org.city}
                          {org.state && org.city ? `, ${org.state}` : ''}
                        </span>
                      </div>
                    </Link>
                  </Surface>
                </CarouselItem>
              );
            })}
          </>
        </OrganizationCarousel>
        <Link href="/org" className="text-sm text-teal">
          See more
        </Link>
      </div>
    </>
  );
};

export const OrganizationSummaryList = ({
  organizations,
}: {
  organizations: Array<Organization>;
}) => {
  return (
    <div className="flex flex-col gap-6">
      {organizations?.map((org) => {
        return (
          <div key={org.id}>
            <Link className="flex items-start gap-6" href={`/org/${org.slug}`}>
              <OrganizationAvatar
                organization={org}
                className="size-6 sm:size-12"
              />

              <div className="flex flex-col gap-2 text-neutral-black">
                <span className="font-semibold leading-base">{org.name}</span>
                {org.city ? (
                  <span className="text-neutral-gray4">{org.city}</span>
                ) : null}
                <span className="text-neutral-charcoal">{org.bio}</span>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export const OrganizationListSkeleton = () => {
  return (
    <div className="hidden flex-col gap-6 sm:flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <div className="flex items-center gap-4">
            <OrganizationAvatarSkeleton className="size-8" />

            <div className="flex w-full flex-col text-sm">
              <SkeletonLine className="w-full" lines={2} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
