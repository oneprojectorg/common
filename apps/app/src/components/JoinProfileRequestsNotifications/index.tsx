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

/**
 * Displays pending join profile requests as a notification panel,
 * allowing users to accept or decline requests from other profiles.
 */
export const JoinProfileRequestsNotifications = (props: {
  targetProfileId: string;
}) => {
  return (
    <ErrorBoundary fallback={<JoinProfileRequestsNotificationsError />}>
      <Suspense fallback={null}>
        <JoinProfileRequestsNotificationsSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const JoinProfileRequestsNotificationsSuspense = ({
  targetProfileId,
}: {
  targetProfileId: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [{ items: requests }] = trpc.profile.listJoinRequests.useSuspenseQuery({
    targetProfileId,
    status: JoinProfileRequestStatus.PENDING,
    limit: 20,
  });

  const updateRequestMutation = trpc.profile.updateJoinRequest.useMutation({
    onSuccess: (_, variables) => {
      toast.success({
        title:
          variables.status === JoinProfileRequestStatus.APPROVED
            ? t('Request accepted')
            : t('Request declined'),
      });
      utils.profile.listJoinRequests.invalidate();
    },
    onError: () => {
      toast.error({
        title: t('Failed to update request'),
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
        title={t('Join requests')}
        // TODO: count is not actually correct - will be addressed separately
        count={count}
      />
      <NotificationPanelList>
        {requests.map((request) => {
          const requestProfile = request.requestProfile;

          const isPendingForRequest =
            updateRequestMutation.isPending &&
            updateRequestMutation.variables?.requestId === request.id;

          const isLoadingReject =
            isPendingForRequest &&
            updateRequestMutation.variables?.status ===
              JoinProfileRequestStatus.REJECTED;

          const isLoadingApprove =
            isPendingForRequest &&
            updateRequestMutation.variables?.status ===
              JoinProfileRequestStatus.APPROVED;

          return (
            <NotificationPanelItem key={request.id}>
              <ProfileItem
                avatar={<OrganizationAvatar profile={requestProfile} />}
                title={requestProfile.name}
                description={t('{name} wants to join your organization', {
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
                  isDisabled={isPendingForRequest}
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
                  isDisabled={isPendingForRequest}
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

/**
 * Error fallback for JoinProfileRequestsNotifications.
 * Displays a minimal error state within the notification panel.
 */
const JoinProfileRequestsNotificationsError = () => {
  const t = useTranslations();

  return (
    <NotificationPanel>
      <NotificationPanelHeader title={t('Join requests')} count={0} />
      <NotificationPanelList>
        <NotificationPanelItem>
          <p className="text-secondary text-sm">
            {t('Failed to load join requests')}
          </p>
        </NotificationPanelItem>
      </NotificationPanelList>
    </NotificationPanel>
  );
};
