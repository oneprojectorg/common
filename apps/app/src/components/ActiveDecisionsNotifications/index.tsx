'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { ButtonLink } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/ui/NotificationPanel';
import { ProfileItem } from '@op/ui/ProfileItem';
import { Suspense, useState } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const ActiveDecisionsNotificationsSuspense = () => {
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const [{ items: decisions }] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery({
      status: [ProcessStatus.PUBLISHED],
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
          const description = instance?.description;
          const isNavigating = navigatingId === decision.id;

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
                  href={`/decisions/${decision.slug}`}
                  onPress={() => setNavigatingId(decision.id)}
                >
                  {isNavigating ? <LoadingSpinner /> : 'Participate'}
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
