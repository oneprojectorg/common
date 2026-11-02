'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { skipBatch, trpc } from '@op/api/client';
import { type Organization, ProfileRelationshipType } from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import Image from 'next/image';
import { Suspense } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import { ProfileInteractions } from '../ProfileDetails';

export const ProfileHero = ({
  organization,
}: {
  organization: Organization;
}) => {
  const { profile } = organization;
  const headerUrl = getPublicUrl(profile.headerImage?.name);
  const location = organization.whereWeWork
    .map((place) => place.name)
    .join(' • ');

  return (
    <section className="relative isolate flex flex-col md:min-h-46 md:justify-end">
      <div className="relative h-30 bg-hero md:absolute md:inset-0 md:-z-10 md:h-auto">
        {headerUrl ? (
          <Image src={headerUrl} alt="" fill className="object-cover" />
        ) : null}
        <div className="absolute inset-0 hidden bg-linear-to-t from-hero/80 to-transparent md:block" />
      </div>

      <div className="relative flex flex-col gap-2 px-4 pb-4 md:static md:px-6 md:pt-6 md:pb-6 md:text-hero-foreground">
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-3 md:mt-0">
          <OrganizationAvatar
            profile={profile}
            withLink={false}
            className="size-16 ring-3 ring-background md:ring-2 md:ring-hero-foreground"
          />
          <div className="md:absolute md:end-6 md:top-4">
            <ProfileInteractions profile={organization} />
          </div>
        </div>

        <Header1 className="text-title font-normal md:text-headline">
          {profile.name}
        </Header1>

        {location ? (
          <p className="text-base opacity-80">
            <bdi>{location}</bdi>
          </p>
        ) : null}

        {profile.bio ? (
          <p
            dir="auto"
            className="text-base lg:truncate ltr:text-left rtl:text-right"
          >
            {profile.bio}
          </p>
        ) : null}

        <APIErrorBoundary fallbacks={{ default: () => null }}>
          <Suspense fallback={<Skeleton className="h-5 w-48" />}>
            <ProfileHeroCountsSuspense organization={organization} />
          </Suspense>
        </APIErrorBoundary>
      </div>
    </section>
  );
};

const ProfileHeroCountsSuspense = ({
  organization,
}: {
  organization: Organization;
}) => {
  const t = useTranslations('profile');
  const { profile } = organization;
  const [[relationships, followers]] = trpc.useSuspenseQueries((queries) => [
    queries.organization.listRelationships(
      { organizationId: organization.id },
      skipBatch,
    ),
    queries.profile.getRelationships({
      targetProfileId: profile.id,
      types: [ProfileRelationshipType.FOLLOWING],
    }),
  ]);
  const linkClassName = 'text-primary md:text-hero-foreground';

  return (
    <p className="flex flex-wrap items-center gap-1 text-base">
      <Link
        href={`/org/${profile.slug}/relationships`}
        className={linkClassName}
      >
        {t('relationshipCount', { count: relationships.count })}
      </Link>
      <span aria-hidden="true">•</span>
      <Link
        href={`/org/${profile.slug}?tab=followers`}
        className={linkClassName}
      >
        {t('followerCount', { count: followers.following?.length ?? 0 })}
      </Link>
    </p>
  );
};
