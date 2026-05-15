'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { JoinProfileRequestStatus, type Organization } from '@op/api/encoders';
import { Button, ButtonTooltip } from '@op/ui-next/Button';
import { LoadingSpinner } from '@op/ui-next/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui-next/Modal';
import { Skeleton } from '@op/ui-next/Skeleton';
import { toast } from '@op/ui-next/Toast';
import { Suspense, useState, useTransition } from 'react';
import { LuClock, LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Button to request membership to an organization.
 */
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
  const [isPending, startTransition] = useTransition();
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const currentProfileId = user.currentProfile?.id;

  // Check if there's already a pending join request
  const [existingRequest] = trpc.profile.getJoinRequest.useSuspenseQuery({
    requestProfileId: currentProfileId!,
    targetProfileId: profile.profile.id,
  });

  const createJoinRequest = trpc.profile.createJoinRequest.useMutation();
  const deleteJoinRequest = trpc.profile.deleteJoinRequest.useMutation();

  const hasPendingRequest =
    existingRequest?.status === JoinProfileRequestStatus.PENDING;

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
          message: t('Your membership request has been sent to {orgName}', {
            orgName: profile.profile.name,
          }),
        });
      } catch (error) {
        toast.error({
          message: t('Failed to send membership request'),
        });
      }
    });
  };

  const handleCancelRequest = () => {
    if (!existingRequest?.id) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteJoinRequest.mutateAsync({
          requestId: existingRequest.id,
        });

        toast.success({
          message: t('Membership request cancelled'),
        });
      } catch (error) {
        toast.error({
          message: t('Failed to cancel membership request'),
        });
      }

      setIsCancelOpen(false);
    });
  };

  if (hasPendingRequest) {
    return (
      <>
        <ButtonTooltip
          color="secondary"
          className="min-w-full sm:min-w-fit"
          tooltipProps={{
            children: t('Your membership request is pending approval'),
          }}
          onPress={() => setIsCancelOpen(true)}
        >
          <LuClock className="size-4" />
          {t('Requested')}
        </ButtonTooltip>
        <Modal isOpen={isCancelOpen} onOpenChange={setIsCancelOpen}>
          <ModalHeader>{t('Cancel membership request')}</ModalHeader>
          <ModalBody>
            <p>
              {t(
                'Are you sure you want to cancel your membership request to {orgName}?',
                { orgName: profile.profile.name },
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => setIsCancelOpen(false)}
              color="neutral"
              className="w-full sm:w-fit"
            >
              {t('Keep request')}
            </Button>
            <Button
              color="destructive"
              onPress={handleCancelRequest}
              isPending={isPending}
              className="w-full sm:w-fit"
            >
              {isPending ? <LoadingSpinner /> : t('Cancel request')}
            </Button>
          </ModalFooter>
        </Modal>
      </>
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
