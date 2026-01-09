'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { JoinProfileRequestStatus, type Organization } from '@op/api/encoders';
import { Button, ButtonTooltip } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { Suspense, useTransition } from 'react';
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
          <Skeleton className="h-9 sm:min-w-fit w-[106px] min-w-full rounded-lg" />
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

  const handleCancelRequest = (close: () => void) => {
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

      close();
    });
  };

  if (hasPendingRequest) {
    return (
      <DialogTrigger>
        <ButtonTooltip
          color="secondary"
          className="sm:min-w-fit min-w-full"
          tooltipProps={{
            children: t('Your membership request is pending approval'),
          }}
        >
          <LuClock className="size-4" />
          {t('Requested')}
        </ButtonTooltip>
        <Modal>
          <Dialog>
            {({ close }) => (
              <>
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
                    onPress={close}
                    color="neutral"
                    className="sm:w-fit w-full"
                  >
                    {t('Keep request')}
                  </Button>
                  <Button
                    color="destructive"
                    onPress={() => handleCancelRequest(close)}
                    isPending={isPending}
                    className="sm:w-fit w-full"
                  >
                    {isPending ? <LoadingSpinner /> : t('Cancel request')}
                  </Button>
                </ModalFooter>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
    );
  }

  return (
    <ButtonTooltip
      color="secondary"
      onPress={handleRequestMembership}
      isPending={isPending}
      className="sm:min-w-fit min-w-full"
      tooltipProps={{
        children: t('Request to join this organization as a member'),
      }}
    >
      {isPending ? <LoadingSpinner /> : <LuUserPlus className="size-4" />}
      {t('Request')}
    </ButtonTooltip>
  );
};
