'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Organization, ProfileRelationshipType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { Suspense, useTransition } from 'react';
import { LuCheck, LuPlus } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

const FollowButtonSuspense = ({ profile }: { profile: Organization }) => {
  const { user } = useUser();
  const [isPending, startTransition] = useTransition();

  const currentProfileId = user.currentProfile?.id;

  // Check if we're currently following this profile
  const [relationships] = trpc.profile.getRelationships.useSuspenseQuery({
    sourceProfileId: currentProfileId,
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

          return;
        }

        await addRelationship.mutateAsync({
          targetProfileId: profile.profile.id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        });

        toast.success({
          message: `Now following ${profile.profile.name}`,
        });
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
