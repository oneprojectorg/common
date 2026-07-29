'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { Button } from '@op/sense/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/sense/NotificationPanel';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { toast } from '@op/sense/Sonner';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';

const PendingDecisionInvitesSuspense = () => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const router = useRouter();

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
          const avatarUrl = profile.avatarImage?.name
            ? getPublicUrl(profile.avatarImage.name)
            : undefined;
          const isAccepting =
            acceptInvite.isPending &&
            acceptInvite.variables?.inviteId === invite.id;

          return (
            <NotificationPanelItem key={invite.id}>
              <ProfileItem
                avatar={
                  <ProfileAvatar
                    name={profile.name ?? ''}
                    src={avatarUrl}
                    alt={profile.name ?? ''}
                    className="size-12"
                    imageRender={
                      avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={profile.name ?? ''}
                          fill
                          className="object-cover"
                        />
                      ) : undefined
                    }
                  />
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
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    acceptInvite
                      .mutateAsync({ inviteId: invite.id })
                      .then(() => {
                        toast.success(t('Invitation accepted'));
                        if (profile.slug) {
                          router.push(`/decisions/${profile.slug}`);
                        }
                      })
                      .catch(() => {
                        toast.error(t('Failed to accept invitation'));
                      })
                  }
                  loading={isAccepting}
                  disabled={acceptInvite.isPending}
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

export const PendingDecisionInvites = () => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <PendingDecisionInvitesSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};
