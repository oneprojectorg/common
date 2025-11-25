'use client';

import { trpc } from '@op/api/client';
import { Organization, ProfileRelationshipType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { useMutation, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useTransition } from 'react';
import { LuCheck, LuPlus } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

const FollowButtonSuspense = ({ profile }: { profile: Organization }) => {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const input = {
    targetProfileId: profile.profile.id,
    types: [ProfileRelationshipType.FOLLOWING],
  };
  const { data: relationships } = useSuspenseQuery({
    queryKey: [['profile', 'getRelationships'], input],
    queryFn: () => trpc.profile.getRelationships.query(input),
  });

  const followingRelationships = relationships.following || [];
  const isFollowing = followingRelationships.length > 0;

  const addRelationship = useMutation({
    mutationFn: (input: { targetProfileId: string; relationshipType: ProfileRelationshipType; pending: boolean }) =>
      trpc.profile.addRelationship.mutate(input),
  });
  const removeRelationship = useMutation({
    mutationFn: (input: { targetProfileId: string; relationshipType: ProfileRelationshipType }) =>
      trpc.profile.removeRelationship.mutate(input),
  });

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

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [['profile', 'getRelationships'], {
              targetProfileId: profile.profile.id,
              types: [ProfileRelationshipType.FOLLOWING],
            }],
          }),
          queryClient.invalidateQueries({
            queryKey: [['profile', 'getRelationships'], {
              types: [ProfileRelationshipType.FOLLOWING],
              profileType: 'org',
            }],
          }),
          queryClient.invalidateQueries({
            queryKey: [['profile', 'getRelationships']],
          }),
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
