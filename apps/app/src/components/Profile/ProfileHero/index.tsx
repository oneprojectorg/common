'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { skipBatch, trpc } from '@op/api/client';
import {
  type Organization,
  type Profile,
  ProfileRelationshipType,
} from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import Image from 'next/image';
import { Suspense } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import { ProfileColumn } from '../ProfileContent';
import { ProfileInteractions } from '../ProfileDetails';

export const ProfileHero = ({
  organization,
}: {
  organization: Organization;
}) => {
  const { profile } = organization;
  const location = organization.whereWeWork
    .map((place) => place.name)
    .join(' • ');

  return (
    <section className="relative isolate">
      <ProfileHeroCover profile={profile} />

      <ProfileColumn className="relative flex flex-col gap-2 pb-4 md:min-h-46 md:flex-row md:items-start md:gap-4 md:py-8 md:text-hero-foreground">
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-3 md:contents">
          <OrganizationAvatar
            profile={profile}
            withLink={false}
            className="size-16 shrink-0 ring-3 ring-background md:ring-2 md:ring-hero-foreground"
          />
          <div className="md:order-last md:ms-auto md:shrink-0">
            <ProfileInteractions profile={organization} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
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
            <Suspense fallback={<Skeleton className="mt-2 h-5 w-48" />}>
              <ProfileHeroCountsSuspense organization={organization} />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </ProfileColumn>
    </section>
  );
};

const ProfileHeroCover = ({ profile }: { profile: Profile }) => {
  const headerUrl = getPublicUrl(profile.headerImage?.name);

  return (
    <div className="relative h-30 bg-hero md:absolute md:inset-0 md:-z-10 md:h-auto">
      {headerUrl ? (
        <Image src={headerUrl} alt="" fill className="object-cover" />
      ) : null}
      <div className="absolute inset-0 hidden bg-hero/50 md:block" />
    </div>
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
    <p
      aria-live="polite"
      className="flex flex-wrap items-center gap-1 text-base"
    >
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
