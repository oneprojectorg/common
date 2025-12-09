'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { ButtonTooltip } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { Suspense, useTransition } from 'react';
import { LuClock, LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

export const RequestMembershipButton = ({
  profile,
}: {
  profile: Organization;
}) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense
        fallback={
          <Skeleton className="h-9 w-[106px] min-w-full rounded-lg sm:min-w-fit" />
        }
      >
        <RequestMembershipButtonSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};

const RequestMembershipButtonSuspense = ({
  profile,
}: {
  profile: Organization;
}) => {
  const t = useTranslations();
  const { user } = useUser();
  const utils = trpc.useUtils();
  const [isPending, startTransition] = useTransition();

  const currentProfileId = user?.currentProfile?.id;

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
        message: t('You must be logged in to request membership'),
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
          message: t('Membership request sent to {name}', {
            name: profile.profile.name,
          }),
        });

        await utils.profile.getJoinProfileRequest.invalidate({
          requestProfileId: currentProfileId,
          targetProfileId: profile.profile.id,
        });
      } catch (error) {
        toast.error({
          message: t('Failed to send membership request'),
        });
      }
    });
  };

  if (hasPendingRequest) {
    return (
      <ButtonTooltip
        color="secondary"
        isDisabled
        className="min-w-full sm:min-w-fit"
        tooltipProps={{
          children: t('Your membership request is pending approval'),
        }}
      >
        <LuClock className="size-4" />
        {t('Requested')}
      </ButtonTooltip>
    );
  }

  return (
    <ButtonTooltip
      color="secondary"
      onPress={handleRequestMembership}
      isPending={isPending}
      className="min-w-full sm:min-w-fit"
      tooltipProps={{
        children: t('Request to join this organization as a member'),
      }}
    >
      {isPending ? <LoadingSpinner /> : <LuUserPlus className="size-4" />}
      {t('Request')}
    </ButtonTooltip>
  );
};
