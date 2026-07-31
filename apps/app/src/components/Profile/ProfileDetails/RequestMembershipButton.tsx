'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { JoinProfileRequestStatus, type Organization } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
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
  const { user } = useRequiredUser();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

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
      toast.error(t('You must be logged in to request membership'));
      return;
    }

    startTransition(async () => {
      try {
        await createJoinRequest.mutateAsync({
          requestProfileId: currentProfileId,
          targetProfileId: profile.profile.id,
        });

        toast.success(
          t('Your membership request has been sent to {orgName}', {
            orgName: profile.profile.name,
          }),
        );
      } catch (error) {
        toast.error(t('Failed to send membership request'));
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

        toast.success(t('Membership request cancelled'));
      } catch (error) {
        toast.error(t('Failed to cancel membership request'));
      }

      close();
    });
  };

  if (hasPendingRequest) {
    return (
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <TooltipProvider delay={500}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      className="min-w-full sm:min-w-fit"
                    >
                      <LuClock className="size-4" />
                      {t('Requested')}
                    </Button>
                  }
                />
              }
            />
            <TooltipContent>
              {t('Your membership request is pending approval')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Cancel membership request')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p>
              {t(
                'Are you sure you want to cancel your membership request to {orgName}?',
                { orgName: profile.profile.name },
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setCancelOpen(false)}
              variant="outline"
              className="w-full sm:w-fit"
            >
              {t('Keep request')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleCancelRequest(() => setCancelOpen(false))}
              loading={isPending}
              className="w-full sm:w-fit"
            >
              {t('Cancel request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <TooltipProvider delay={500}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              onClick={handleRequestMembership}
              loading={isPending}
              className="min-w-full sm:min-w-fit"
            >
              <LuUserPlus className="size-4" />
              {t('Request')}
            </Button>
          }
        />
        <TooltipContent>
          {t('Request to join this organization as a member')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
