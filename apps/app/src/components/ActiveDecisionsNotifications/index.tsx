'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { Button, ButtonLink } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/ui/NotificationPanel';
import { ProfileItem } from '@op/ui/ProfileItem';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const ActiveDecisionsNotificationsSuspense = () => {
  const router = useRouter();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const [{ items: decisions }] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery({
      status: ProcessStatus.PUBLISHED,
      limit: 10,
    });

  const count = decisions.length;

  if (count === 0) {
    return null;
  }

  return (
    <NotificationPanel>
      <NotificationPanelHeader title="Active Decisions" count={count} />
      <NotificationPanelList>
        {decisions.map((decision) => {
          const instance = decision.processInstance;
          const isPending = navigatingId === decision.id;
          const description = instance?.description;
          const instanceUrl = `/profile/${decision.slug}/decisions/${instance?.id}`;

          return (
            <NotificationPanelItem key={decision.id}>
              <ProfileItem
                avatar={<OrganizationAvatar profile={decision} />}
                title={decision.name}
                description={
                  description
                    ? getTextPreview({ content: description })
                    : undefined
                }
              />
              <NotificationPanelActions>
                <ButtonLink
                  size="small"
                  className="w-full sm:w-auto"
                  href={instanceUrl}
                  onPress={() => {
                    setNavigatingId(decision.id);
                    router.push(instanceUrl);
                  }}
                  isDisabled={isPending}
                >
                  {isPending ? <LoadingSpinner /> : 'Participate'}
                </ButtonLink>
              </NotificationPanelActions>
            </NotificationPanelItem>
          );
        })}
      </NotificationPanelList>
    </NotificationPanel>
  );
};

export const ActiveDecisionsNotifications = () => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <ActiveDecisionsNotificationsSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};
