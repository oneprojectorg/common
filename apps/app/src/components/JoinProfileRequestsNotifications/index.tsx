'use client';
import { useTRPC } from '@op/api/client';
import { JoinProfileRequestStatus } from '@op/api/encoders';
import { PAGE_LIMIT } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/sense/NotificationPanel';
import { ProfileItem } from '@op/sense/ProfileItem';
import { toast } from '@op/sense/Toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
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
  const trpc = useTRPC();
  const t = useTranslations();
  const queryClient = useQueryClient();

  const {
    data: { items: requests },
  } = useSuspenseQuery(
    trpc.profile.listJoinRequests.queryOptions({
      targetProfileId,
      status: JoinProfileRequestStatus.PENDING,
      limit: PAGE_LIMIT.md,
    }),
  );

  const updateRequestMutation = useMutation(
    trpc.profile.updateJoinRequest.mutationOptions({
      onSuccess: (_, variables) => {
        toast.success(
          variables.status === JoinProfileRequestStatus.APPROVED
            ? t('Request accepted')
            : t('Request declined'),
        );
        queryClient.invalidateQueries(
          trpc.profile.listJoinRequests.pathFilter(),
        );
      },
      onError: () => {
        toast.error(t('Failed to update request'));
      },
    }),
  );

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
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    handleUpdateRequest(
                      request.id,
                      JoinProfileRequestStatus.REJECTED,
                    )
                  }
                  loading={isLoadingReject}
                  disabled={isPendingForRequest}
                >
                  {t('Decline')}
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    handleUpdateRequest(
                      request.id,
                      JoinProfileRequestStatus.APPROVED,
                    )
                  }
                  loading={isLoadingApprove}
                  disabled={isPendingForRequest}
                >
                  {t('Accept')}
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
          <p className="text-sm text-secondary">
            {t('Failed to load join requests')}
          </p>
        </NotificationPanelItem>
      </NotificationPanelList>
    </NotificationPanel>
  );
};
