'use client';

import { trpc } from '@op/api/client';
import { Organization, ProfileRelationshipType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { Suspense, useTransition } from 'react';
import { LuCheck, LuPlus } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

const FollowButtonSuspense = ({ profile }: { profile: Organization }) => {
  const utils = trpc.useUtils();
  const [isPending, startTransition] = useTransition();

  // Check if we're currently following this profile
  const [relationships] = trpc.profile.getRelationships.useSuspenseQuery({
    targetProfileId: profile.profile.id,
    types: [ProfileRelationshipType.FOLLOWING],
  });

  const followingRelationships = relationships.following || [];
  const isFollowing = followingRelationships.length > 0;

  const addRelationship = trpc.profile.addRelationship.useMutation();
  const removeRelationship = trpc.profile.removeRelationship.useMutation();

  const handleFollowToggle = () => {
    startTransition(async () => {
      try {
        if (isFollowing) {
          await removeRelationship.mutateAsync({
            targetProfileId: profile.profile.id,
            relationshipType: ProfileRelationshipType.FOLLOWING,
          });

          toast.success({
            message: `Unfollowed ${profile.profile.name}`,
          });
        } else {
          await addRelationship.mutateAsync({
            targetProfileId: profile.profile.id,
            relationshipType: ProfileRelationshipType.FOLLOWING,
            pending: false,
          });

          toast.success({
            message: `Now following ${profile.profile.name}`,
          });
        }

        // Invalidate all relationship-related queries
        await Promise.all([
          // Invalidate the query that checks if we're following this profile
          utils.profile.getRelationships.invalidate({
            targetProfileId: profile.profile.id,
            types: [ProfileRelationshipType.FOLLOWING],
          }),
          // Invalidate the current user's following list
          utils.profile.getRelationships.invalidate({
            types: [ProfileRelationshipType.FOLLOWING],
            profileType: 'org',
          }),
          // Invalidate all relationship queries for this target profile
          utils.profile.getRelationships.invalidate(),
        ]);
      } catch (error) {
        toast.error({
          message: isFollowing ? 'Failed to unfollow' : 'Failed to follow',
        });
      }
    });
  };

  return (
    <Button
      onPress={handleFollowToggle}
      isPending={isPending}
      color={isFollowing ? 'verified' : 'primary'}
      className="min-w-full sm:min-w-fit"
    >
      {isPending ? (
        <LoadingSpinner />
      ) : isFollowing ? (
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
      <Suspense
        fallback={
          <Button isDisabled={true}>
            <LoadingSpinner />
          </Button>
        }
      >
        <FollowButtonSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
