'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
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
import Image from 'next/image';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';

const PendingDecisionInvitesSuspense = () => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [invites] = trpc.account.listUserInvites.useSuspenseQuery({
    entityType: EntityType.DECISION,
    pending: true,
  });

  const acceptInvite = trpc.profile.acceptInvite.useMutation({
    onSuccess: () => {
      utils.account.listUserInvites.invalidate();
      utils.decision.listDecisionProfiles.invalidate();
    },
  });

  if (invites.length === 0) {
    return null;
  }

  return (
    <NotificationPanel>
      <NotificationPanelHeader
        title={t('Decision Invitations')}
        count={invites.length}
      />
      <NotificationPanelList>
        {invites.map((invite) => {
          const profile = invite.profile;
          const description = profile.processInstance?.description;
          const isAccepting =
            acceptInvite.isPending &&
            acceptInvite.variables?.inviteId === invite.id;

          return (
            <NotificationPanelItem key={invite.id}>
              <ProfileItem
                avatar={
                  <Avatar className="size-12" placeholder={profile.name ?? ''}>
                    {profile.avatarImage?.name ? (
                      <Image
                        src={getPublicUrl(profile.avatarImage.name) ?? ''}
                        alt={profile.name ?? ''}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                  </Avatar>
                }
                title={profile.name ?? ''}
                description={
                  description
                    ? getTextPreview({ content: description })
                    : undefined
                }
              />
              <NotificationPanelActions>
                <Button
                  size="small"
                  className="w-full sm:w-auto"
                  onPress={() => acceptInvite.mutate({ inviteId: invite.id })}
                  isDisabled={acceptInvite.isPending}
                >
                  {isAccepting ? <LoadingSpinner /> : t('Accept')}
                </Button>
              </NotificationPanelActions>
            </NotificationPanelItem>
          );
        })}
      </NotificationPanelList>
    </NotificationPanel>
  );
};

export const PendingDecisionInvites = () => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <PendingDecisionInvitesSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};
