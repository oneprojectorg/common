'use client';

import { getPublicUrl } from '@/utils';
import { Organization } from '@op/api/encoders';
import { Card } from '@op/sense/Card';
import { HorizontalList, HorizontalListItem } from '@op/sense/HorizontalList';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { getGradientForString } from '@op/styles/constants';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import {
  OrganizationAvatar,
  OrganizationAvatarSkeleton,
} from '@/components/OrganizationAvatar';
import { ProfileAvatarLink } from '@/components/ProfileAvatarLink';

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
              <OrganizationAvatar profile={org.profile} className="size-8" />

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
        <HorizontalList className="scroll-px-4">
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
                className="snap-start first:ms-4 last:me-4"
              >
                <Link
                  className="flex size-48"
                  href={`/org/${org.profile.slug}`}
                >
                  <Card className="size-full gap-3 py-0">
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
                    <div className="flex flex-col p-4 pt-0 text-start">
                      <span>
                        <bdi>{org.profile.name}</bdi>
                      </span>
                    </div>
                  </Card>
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
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {organizations.map((relationshipOrg) => (
        <div
          key={relationshipOrg.id}
          className="flex w-full gap-4 rounded border p-6"
        >
          <div className="shrink-0">
            <OrganizationAvatar
              profile={relationshipOrg.profile}
              className="size-20"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Link
                  className="truncate font-semibold text-foreground"
                  href={`/org/${relationshipOrg.profile.slug}`}
                >
                  <bdi>{relationshipOrg.profile.name}</bdi>
                </Link>
              </div>

              <div dir="auto" className="line-clamp-3 text-foreground">
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
        const whereWeWork =
          org.whereWeWork?.map((location: any) => location.name).join(' • ') ??
          [];

        const trimmedBio =
          org.profile.bio && org.profile.bio.length > 325
            ? `${org.profile.bio.slice(0, 325)}...`
            : org.profile.bio;

        const orgAvatarUrl =
          getPublicUrl(
            org.profile.avatarImage?.name ?? org.avatarImage?.name,
          ) ?? undefined;

        return (
          <div key={org.id}>
            <div className="flex items-start gap-2 py-2 sm:gap-6">
              <ProfileAvatarLink
                href={`/org/${org.profile.slug}`}
                name={org.profile.name ?? ''}
                src={orgAvatarUrl}
                alt={org.profile.name ?? ''}
                className="size-8 sm:size-12"
              />

              <div className="flex flex-col gap-3 text-foreground">
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/org/${org.profile.slug}`}
                    className="leading-base font-semibold"
                  >
                    <bdi>{org.profile.name}</bdi>
                  </Link>
                  {org.whereWeWork?.length > 0 ? (
                    <span
                      dir="auto"
                      className="text-sm text-muted-foreground sm:text-base"
                    >
                      {whereWeWork}
                    </span>
                  ) : null}
                </div>
                <span dir="auto" className="text-foreground">
                  {trimmedBio}
                </span>
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

            <div className="flex w-full flex-col gap-2 text-sm">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const OrganizationCardListSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex w-full gap-4 rounded border p-6">
          <div className="shrink-0">
            <OrganizationAvatarSkeleton className="size-20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-3/4" />
              </div>
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
