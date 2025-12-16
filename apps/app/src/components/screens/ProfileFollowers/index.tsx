'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import React, { Suspense, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  RelationshipList,
  type RelationshipListItem,
} from '@/components/RelationshipList';
import { RelationshipTabSkeleton } from '@/components/skeletons/RelationshipTabSkeleton';

export const ProfileFollowersSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const t = useTranslations();

  // Get relationships where this profile is the target (people following this profile)
  const [relationships] = trpc.profile.getRelationships.useSuspenseQuery({
    targetProfileId: profileId,
    types: [ProfileRelationshipType.FOLLOWING],
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
    <div className="flex flex-col gap-4 text-base sm:gap-8">
      <RelationshipList
        profiles={followers}
        title={`${followers.length} ${pluralize(t('follower'), followers.length)}`}
      />
    </div>
  );
};

export const ProfileFollowers = ({ profileId }: { profileId: string }) => {
  return (
    <div className="pt-4 sm:pt-8">
      <ErrorBoundary fallback={null}>
        <Suspense fallback={<RelationshipTabSkeleton />}>
          <ProfileFollowersSuspense profileId={profileId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};
