'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { Suspense, useTransition } from 'react';
import { LuClock, LuUserPlus } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

const RequestMembershipButtonSuspense = ({
  profile,
}: {
  profile: Organization;
}) => {
  const { user } = useUser();
  const utils = trpc.useUtils();
  const [isPending, startTransition] = useTransition();

  const currentProfileId = user?.currentProfile?.id;

  // Check if user is already a member of this organization
  const isAlreadyMember = user?.organizationUsers?.some(
    (orgUser) => orgUser.organization?.profile?.id === profile.profile.id,
  );

  // Check if there's already a pending join request
  const [existingRequest] = trpc.profile.getJoinProfileRequest.useSuspenseQuery(
    {
      requestProfileId: currentProfileId!,
      targetProfileId: profile.profile.id,
    },
  );

  const createJoinRequest = trpc.profile.createJoinProfileRequest.useMutation();

  const hasPendingRequest = existingRequest?.status === 'pending';

  const handleRequestMembership = () => {
    if (!currentProfileId) {
      toast.error({
        message: 'You must be logged in to request membership',
      });
      return;
    }

    startTransition(async () => {
      try {
        await createJoinRequest.mutateAsync({
          requestProfileId: currentProfileId,
          targetProfileId: profile.profile.id,
        });

        toast.success({
          message: `Membership request sent to ${profile.profile.name}`,
        });

        await utils.profile.getJoinProfileRequest.invalidate({
          requestProfileId: currentProfileId,
          targetProfileId: profile.profile.id,
        });
      } catch (error) {
        toast.error({
          message: 'Failed to send membership request',
        });
      }
    });
  };

  // Don't show the button if user is already a member
  if (isAlreadyMember) {
    return null;
  }

  if (hasPendingRequest) {
    return (
      <Button color="secondary" isDisabled className="min-w-full sm:min-w-fit">
        <LuClock className="size-4" />
        Requested
      </Button>
    );
  }

  return (
    <Button
      color="secondary"
      onPress={handleRequestMembership}
      isPending={isPending}
      className="min-w-full sm:min-w-fit"
    >
      {isPending ? (
        <LoadingSpinner />
      ) : (
        <>
          <LuUserPlus className="size-4" />
          Request Membership
        </>
      )}
    </Button>
  );
};

export const RequestMembershipButton = ({
  profile,
}: {
  profile: Organization;
}) => {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <Button
            color="secondary"
            isDisabled
            className="min-w-full sm:min-w-fit"
          >
            <LoadingSpinner />
          </Button>
        }
      >
        <RequestMembershipButtonSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
