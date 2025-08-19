'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import React, { Suspense, useMemo } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  RelationshipList,
  type RelationshipListItem,
} from '@/components/RelationshipList';

export const ProfileFollowingSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const [relationships] = trpc.profile.getRelationships.useSuspenseQuery({
    sourceProfileId: profileId,
    includeTargetProfiles: true,
  });

  // Filter for following relationships and extract target profiles
  const following: RelationshipListItem[] = useMemo(() => {
    return relationships
      .filter(
        (rel) => rel.relationshipType === 'following' && rel.targetProfile,
      )
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
      <Suspense fallback={<div>Loading following...</div>}>
        <ProfileFollowingSuspense profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
  );
};
