'use client';

import { getPublicUrl } from '@/utils';
import { Organization } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { HorizontalList, HorizontalListItem } from '@op/ui/HorizontalList';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import {
  OrganizationAvatar,
  OrganizationAvatarSkeleton,
} from '@/components/OrganizationAvatar';

export const OrganizationList = ({
  organizations,
}: {
  organizations: Array<Organization>;
}) => {
  return (
    <>
      <div className="gap-6 sm:flex hidden flex-col">
        {organizations?.map((org) => {
          return (
            <div key={org.id} className="gap-2 flex items-center">
              <OrganizationAvatar profile={org.profile} className="size-8" />

              <div className="min-w-0 sm:text-base flex flex-col text-sm">
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
      <div className="gap-6 sm:hidden flex flex-col">
        <HorizontalList className="scroll-px-8">
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
              <HorizontalListItem
                key={org.id}
                className="first:ml-8 last:mr-8 snap-start"
              >
                <Link
                  className="size-48 flex"
                  href={`/org/${org.profile.slug}`}
                >
                  <Surface className="gap-3 flex size-full flex-col">
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
                    <div className="p-4 pt-0 flex flex-col text-left">
                      <span>{org.profile.name}</span>
                    </div>
                  </Surface>
                </Link>
              </HorizontalListItem>
            );
          })}
        </HorizontalList>
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
    <div className="gap-8 pb-6 md:grid-cols-2 grid grid-cols-1">
      {organizations.map((relationshipOrg) => (
        <div
          key={relationshipOrg.id}
          className="gap-4 p-6 flex w-full rounded border"
        >
          <div className="shrink-0">
            <OrganizationAvatar
              profile={relationshipOrg.profile}
              className="size-20"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="gap-2 flex flex-col">
              <div className="gap-2 flex flex-col">
                <Link
                  className="font-semibold truncate text-neutral-black"
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
    <div className="gap-6 flex flex-col">
      {organizations?.map((org) => {
        const whereWeWork =
          org.whereWeWork?.map((location: any) => location.name).join(' • ') ??
          [];

        const trimmedBio =
          org.profile.bio && org.profile.bio.length > 325
            ? `${org.profile.bio.slice(0, 325)}...`
            : org.profile.bio;

        return (
          <div key={org.id}>
            <div className="gap-2 py-2 sm:gap-6 flex items-start">
              <Link
                href={`/org/${org.profile.slug}`}
                className="hover:no-underline"
              >
                <Avatar
                  className="size-8 sm:size-12 hover:opacity-80"
                  placeholder={org.profile.name ?? ''}
                >
                  {org.profile?.name ? (
                    <Image
                      src={
                        getPublicUrl(
                          org.profile.avatarImage?.name ??
                            org.avatarImage?.name,
                        ) ?? ''
                      }
                      alt={org.profile.name ?? ''}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </Avatar>
              </Link>

              <div className="gap-3 flex flex-col text-neutral-black">
                <div className="gap-2 flex flex-col">
                  <Link
                    href={`/org/${org.profile.slug}`}
                    className="font-semibold leading-base"
                  >
                    {org.profile.name}
                  </Link>
                  {org.whereWeWork?.length > 0 ? (
                    <span className="sm:text-base text-sm text-neutral-gray4">
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
    <div className="gap-6 sm:flex hidden flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <div className="gap-4 flex items-center">
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

export const OrganizationCardListSkeleton = () => {
  return (
    <div className="gap-8 pb-6 md:grid-cols-2 grid grid-cols-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="gap-4 p-6 flex w-full rounded border">
          <div className="shrink-0">
            <OrganizationAvatarSkeleton className="size-20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="gap-2 flex flex-col">
              <div className="gap-2 flex flex-col">
                <Skeleton className="h-6 w-3/4" />
              </div>
              <SkeletonLine lines={3} randomWidth={true} className="w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
