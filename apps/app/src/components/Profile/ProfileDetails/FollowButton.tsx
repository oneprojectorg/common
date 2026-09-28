'use client';
import { useRequiredUser } from '@/utils/UserProvider';
import { useTRPC } from '@op/api/client';
import { Organization, ProfileRelationshipType } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useTransition } from 'react';
import { LuCheck, LuPlus } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

import { relationshipActiveButtonClass } from './relationshipButton';

const FollowButtonSuspense = ({ profile }: { profile: Organization }) => {
  const trpc = useTRPC();
  const { user } = useRequiredUser();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const currentProfileId = user.currentProfile?.id;

  // Check if we're currently following this profile
  const { data: relationships } = useSuspenseQuery(
    trpc.profile.getRelationships.queryOptions({
      sourceProfileId: currentProfileId,
      targetProfileId: profile.profile.id,
      types: [ProfileRelationshipType.FOLLOWING],
    }),
  );

  const followingRelationships = relationships.following || [];
  const isFollowing = followingRelationships.length > 0;

  const addRelationship = useMutation(
    trpc.profile.addRelationship.mutationOptions(),
  );
  const removeRelationship = useMutation(
    trpc.profile.removeRelationship.mutationOptions(),
  );

  const handleFollowToggle = () => {
    startTransition(async () => {
      try {
        if (isFollowing) {
          await removeRelationship.mutateAsync({
            targetProfileId: profile.profile.id,
            relationshipType: ProfileRelationshipType.FOLLOWING,
          });

          toast.success(`Unfollowed ${profile.profile.name}`);
        } else {
          await addRelationship.mutateAsync({
            targetProfileId: profile.profile.id,
            relationshipType: ProfileRelationshipType.FOLLOWING,
            pending: false,
          });

          toast.success(`Now following ${profile.profile.name}`);
        }

        // Invalidate all relationship-related queries
        await Promise.all([
          queryClient.invalidateQueries(
            // Invalidate the query that checks if we're following this profile
            trpc.profile.getRelationships.queryFilter({
              sourceProfileId: currentProfileId,
              targetProfileId: profile.profile.id,
              types: [ProfileRelationshipType.FOLLOWING],
            }),
          ),
          queryClient.invalidateQueries(
            // Invalidate the current user's following list
            trpc.profile.getRelationships.queryFilter({
              types: [ProfileRelationshipType.FOLLOWING],
              profileType: 'org',
            }),
          ),
          queryClient.invalidateQueries(
            // Invalidate all relationship queries for this target profile
            trpc.profile.getRelationships.pathFilter(),
          ),
        ]);
      } catch (error) {
        toast.error(isFollowing ? 'Failed to unfollow' : 'Failed to follow');
      }
    });
  };

  return (
    <Button
      onClick={handleFollowToggle}
      loading={isPending}
      variant={isFollowing ? 'outline' : 'default'}
      className={cn(
        'min-w-full sm:min-w-fit',
        isFollowing && relationshipActiveButtonClass,
      )}
    >
      {isFollowing ? (
        <>
          <LuCheck className="size-4" />
          Following
        </>
      ) : (
        <>
          <LuPlus className="size-4" />
          Follow
        </>
      )}
    </Button>
  );
};

export const FollowButton = ({ profile }: { profile: Organization }) => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Button disabled loading />}>
        <FollowButtonSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
