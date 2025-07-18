'use client';

import { getPublicUrl } from '@/utils';
import { Organization } from '@op/api/encoders';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { cn, getGradientForString } from '@op/ui/utils';
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
            <div key={org.id} className="flex items-center gap-2">
              <OrganizationAvatar organization={org} className="size-8" />

              <div className="flex min-w-0 flex-col text-sm sm:text-base">
                <Link
                  className="max-w-full truncate text-nowrap hover:underline"
                  href={`/org/${org.profile.slug}`}
                >
                  {org.profile.name}
                </Link>
                <span>{org.profile.city}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* mobile */}
      <div className="flex flex-col gap-6 sm:hidden">
        <OrganizationCarousel label="New Organizations" itemWidth={192}>
          <>
            {organizations?.map((org) => {
              const { avatarImage, headerImage } = org.profile;
              const avatarUrl = getPublicUrl(avatarImage?.name);
              const headerUrl = getPublicUrl(headerImage?.name);

              const gradientBg = getGradientForString(
                org.profile.name || 'Common',
              );
              const gradientBgHeader = getGradientForString(
                org.profile.name + 'C' || 'Common',
              );

              return (
                <CarouselItem key={org.id}>
                  <Surface className="flex size-48">
                    <Link
                      className="flex size-full flex-col gap-3"
                      href={`/org/${org.profile.slug}`}
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
                          ) : (
                            <div
                              className={cn('h-full w-full', gradientBgHeader)}
                            />
                          )
                        }
                        avatarImage={
                          avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className={cn('h-full w-full', gradientBg)} />
                          )
                        }
                      />

                      <div className="flex flex-col p-4 pt-0 text-left">
                        <span>{org.profile.name}</span>
                      </div>
                    </Link>
                  </Surface>
                </CarouselItem>
              );
            })}
          </>
        </OrganizationCarousel>
      </div>
    </>
  );
};

export const OrganizationCardList = ({
  organizations,
}: {
  organizations: Array<Organization>;
}) => {
  return (
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {organizations.map((relationshipOrg) => (
        <div
          key={relationshipOrg.id}
          className="flex w-full gap-4 rounded border border-neutral-gray1 p-6"
        >
          <div className="flex-shrink-0">
            <OrganizationAvatar
              organization={relationshipOrg}
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

export const OrganizationSummaryList = ({
  organizations,
}: {
  organizations: Array<Organization>;
}) => {
  return (
    <div className="flex flex-col gap-6">
      {organizations?.map((org) => {
        const whereWeWork = org.whereWeWork
          .map((location) => location.name)
          .join(' • ');

        const trimmedBio =
          org.profile.bio && org.profile.bio.length > 325
            ? `${org.profile.bio.slice(0, 325)}...`
            : org.profile.bio;

        return (
          <div key={org.id}>
            <div className="flex items-start gap-2 py-2 sm:gap-6">
              <OrganizationAvatar
                organization={org}
                className="size-8 sm:size-12"
              />

              <div className="flex flex-col gap-3 text-neutral-black">
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/org/${org.profile.slug}`}
                    className="font-semibold leading-base"
                  >
                    {org.profile.name}
                  </Link>
                  {whereWeWork.length > 0 ? (
                    <span className="text-sm text-neutral-gray4 sm:text-base">
                      {whereWeWork}
                    </span>
                  ) : null}
                </div>
                <span className="text-neutral-charcoal">{trimmedBio}</span>
              </div>
            </div>
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
