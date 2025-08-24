'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import React, { Suspense, useMemo } from 'react';

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
  // Get relationships where this profile is the target (people following this profile)
  const [relationships] = trpc.profile.getRelationships.useSuspenseQuery({
    targetProfileId: profileId,
  });

  // Filter for following relationships and extract source profiles (followers)
  const followers: RelationshipListItem[] = useMemo(() => {
    return relationships
      .filter(
        (rel) => rel.relationshipType === 'following' && rel.sourceProfile,
      )
      .map((rel) => rel.sourceProfile!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [relationships]);

  return (
    <div className="flex flex-col gap-4 text-base sm:gap-8 sm:py-8">
      <RelationshipList
        profiles={followers}
        title={`${followers.length} ${pluralize('follower', followers.length)}`}
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
