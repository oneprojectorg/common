'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { useSuspenseQuery } from '@tanstack/react-query';
import React, { Suspense, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  RelationshipList,
  type RelationshipListItem,
} from '@/components/RelationshipList';

import { ProfileRelationshipsSkeleton } from '../ProfileRelationships/Skeleton';

export const ProfileFollowersSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const t = useTranslations();

  const queryInput = {
    targetProfileId: profileId,
    types: [ProfileRelationshipType.FOLLOWING],
  };

  const { data: relationships } = useSuspenseQuery({
    queryKey: [['profile', 'getRelationships'], queryInput],
    queryFn: () => trpc.profile.getRelationships.query(queryInput),
  });

  // Filter for following relationships and extract source profiles (followers)
  const followers: RelationshipListItem[] = useMemo(() => {
    const followingRelationships = relationships.following || [];
    return followingRelationships
      .filter((rel) => rel.sourceProfile)
      .map((rel) => rel.sourceProfile!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [relationships]);

  return (
    <div className="flex flex-col gap-4 text-base sm:gap-8 sm:py-8">
      <RelationshipList
        profiles={followers}
        title={`${followers.length} ${pluralize(t('follower'), followers.length)}`}
      />
    </div>
  );
};

export const ProfileFollowers = ({ profileId }: { profileId: string }) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={<ProfileRelationshipsSkeleton />}>
        <ProfileFollowersSuspense profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
  );
};
