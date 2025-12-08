'use client';

import { trpc } from '@op/api/client';
import { JoinProfileRequestStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/ui/NotificationPanel';
import { ProfileItem } from '@op/ui/ProfileItem';
import { toast } from '@op/ui/Toast';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const JoinProfileRequestsNotificationsSuspense = ({
  targetProfileId,
}: {
  targetProfileId: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [{ items: requests }] =
    trpc.profile.listJoinProfileRequests.useSuspenseQuery({
      targetProfileId,
      status: JoinProfileRequestStatus.PENDING,
      limit: 10,
    });

  const updateRequestMutation =
    trpc.profile.updateJoinProfileRequest.useMutation({
      onSuccess: (_, variables) => {
        toast.success({
          title:
            variables.status === JoinProfileRequestStatus.APPROVED
              ? t('joinProfileRequests_requestAccepted')
              : t('joinProfileRequests_requestDeclined'),
        });
        utils.profile.listJoinProfileRequests.invalidate();
      },
      onError: () => {
        toast.error({
          title: t('joinProfileRequests_updateError'),
        });
      },
    });

  const handleUpdateRequest = (
    requestId: string,
    status:
      | JoinProfileRequestStatus.APPROVED
      | JoinProfileRequestStatus.REJECTED,
  ) => {
    updateRequestMutation.mutate({ requestId, status });
  };

  const count = requests.length;

  if (count === 0) {
    return null;
  }

  return (
    <NotificationPanel>
      <NotificationPanelHeader
        title={t('joinProfileRequests_title')}
        count={count}
      />
      <NotificationPanelList>
        {requests.map((request) => {
          const requestProfile = request.requestProfile;

          const isLoadingReject =
            updateRequestMutation.variables?.requestId === request.id &&
            updateRequestMutation.variables?.status ===
              JoinProfileRequestStatus.REJECTED;

          const isLoadingApprove =
            updateRequestMutation.variables?.requestId === request.id &&
            updateRequestMutation.variables?.status ===
              JoinProfileRequestStatus.APPROVED;

          return (
            <NotificationPanelItem key={request.id}>
              <ProfileItem
                avatar={<OrganizationAvatar profile={requestProfile} />}
                title={requestProfile.name}
                description={t('joinProfileRequests_requestDescription', {
                  name: requestProfile.name,
                })}
              />
              <NotificationPanelActions>
                <Button
                  size="small"
                  color="secondary"
                  className="w-full sm:w-auto"
                  onPress={() =>
                    handleUpdateRequest(
                      request.id,
                      JoinProfileRequestStatus.REJECTED,
                    )
                  }
                  isDisabled={isLoadingReject}
                >
                  {isLoadingReject ? <LoadingSpinner /> : t('Decline')}
                </Button>
                <Button
                  size="small"
                  className="w-full sm:w-auto"
                  onPress={() =>
                    handleUpdateRequest(
                      request.id,
                      JoinProfileRequestStatus.APPROVED,
                    )
                  }
                  isDisabled={isLoadingApprove}
                >
                  {isLoadingApprove ? <LoadingSpinner /> : t('Accept')}
                </Button>
              </NotificationPanelActions>
            </NotificationPanelItem>
          );
        })}
      </NotificationPanelList>
    </NotificationPanel>
  );
};

export const JoinProfileRequestsNotifications = ({
  targetProfileId,
}: {
  targetProfileId: string;
}) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <JoinProfileRequestsNotificationsSuspense
          targetProfileId={targetProfileId}
        />
      </Suspense>
    </ErrorBoundary>
  );
};
