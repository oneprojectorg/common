'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { EntityType, ProfileRelationshipType } from '@op/api/encoders';
import React, { Suspense, useMemo } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  RelationshipList,
  type RelationshipListItem,
} from '@/components/RelationshipList';

import { ProfileRelationshipsSkeleton } from '../ProfileRelationships/Skeleton';

export const ProfileFollowingSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const [relationships] = trpc.profile.getRelationships.useSuspenseQuery({
    sourceProfileId: profileId,
    relationshipType: ProfileRelationshipType.FOLLOWING,
    profileType: EntityType.ORG,
  });

  // Extract target profiles
  const following: RelationshipListItem[] = useMemo(() => {
    return relationships
      .filter((rel) => rel.targetProfile)
      .map((rel) => rel.targetProfile!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [relationships]);

  return (
    <div className="flex flex-col gap-4 text-base sm:gap-8 sm:py-8">
      <RelationshipList
        profiles={following}
        title={`Following ${following.length} ${pluralize('organization', following.length)}`}
      />
    </div>
  );
};

export const ProfileFollowing = ({ profileId }: { profileId: string }) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={<ProfileRelationshipsSkeleton />}>
        <ProfileFollowingSuspense profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
  );
};
