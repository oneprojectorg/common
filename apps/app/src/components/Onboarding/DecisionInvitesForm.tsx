'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ProfileItem } from '@op/ui/ProfileItem';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { ReactNode, Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { FormContainer } from '../form/FormContainer';
import { DecisionInvitesSkeleton } from './DecisionInvitesSkeleton';

type DecisionInvitesFormProps = {
  onComplete: () => void;
  className?: string;
};

export const DecisionInvitesForm = ({
  onComplete,
  className,
}: DecisionInvitesFormProps): ReactNode => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isLoading, setIsLoading] = useState(false);

  const [invites, { refetch }] = trpc.account.listUserInvites.useSuspenseQuery(
    {
      entityType: EntityType.DECISION,
      pending: true,
    },
    {
      // Always fetch fresh data to ensure we don't skip due to stale cache
      staleTime: 0,
      refetchOnMount: 'always',
    },
  );

  const acceptInvite = trpc.profile.acceptInvite.useMutation({
    onSuccess: () => {
      utils.account.getMyAccount.invalidate();
    },
  });

  const declineInvite = trpc.profile.declineInvite.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // If no invites, automatically skip to the multi-step form
  useEffect(() => {
    if (invites && invites.length === 0) {
      onComplete();
    }
  }, [invites, onComplete]);

  const handleDecline = async (inviteId: string) => {
    try {
      await declineInvite.mutateAsync({ inviteId });
    } catch (error) {
      toast.error({
        message: t('Failed to decline invitation'),
      });
    }
  };

  const handleAcceptAll = async () => {
    if (!invites || invites.length === 0) {
      onComplete();
      return;
    }

    setIsLoading(true);
    try {
      // Accept all remaining invites in parallel
      await Promise.all(
        invites.map((invite) =>
          acceptInvite.mutateAsync({ inviteId: invite.id }),
        ),
      );
      // Invalidate account data to refresh org memberships
      await utils.account.getMyAccount.invalidate();
      onComplete();
    } catch (error) {
      setIsLoading(false);
      toast.error({
        message: t('Failed to accept invitations'),
      });
    }
  };

  if (!invites || invites.length === 0) {
    return <DecisionInvitesSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-lg flex-1 flex-col justify-center',
        className,
      )}
    >
      <FormContainer className="gap-6">
        {/* Header section - gap-2 (8px) between title and subtitle */}
        <div className="flex flex-col gap-2 text-center">
          <Header1 className="text-neutral-black">
            {t('Join decision-making processes')}
          </Header1>
          <p className="text-sm text-neutral-gray4">
            {t(
              "You've been invited to join the following decision-making processes",
            )}
          </p>
        </div>

        {/* List of invite cards */}
        <div className="flex flex-col gap-6">
          {invites.map((invite) => {
            const profile = invite.profile;
            const processInstance = profile?.processInstance;
            const steward = processInstance?.steward;

            return (
              <div key={invite.id} className="flex flex-col gap-2">
                <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <ProfileItem
                    size="small"
                    className="items-center gap-2"
                    avatar={
                      <Avatar
                        placeholder={steward?.name ?? ''}
                        className="size-6 shrink-0"
                      >
                        {steward?.avatarImage?.name ? (
                          <Image
                            src={getPublicUrl(steward.avatarImage.name) ?? ''}
                            alt={steward.name ?? ''}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </Avatar>
                    }
                    title={profile?.name ?? ''}
                  >
                    {steward?.name ? (
                      <span className="text-sm text-neutral-gray4">
                        {steward.name}
                      </span>
                    ) : null}
                  </ProfileItem>
                  <div className="flex items-end gap-4 text-neutral-black sm:items-center sm:gap-12">
                    <DecisionStat
                      number={invite.participantCount}
                      label={t('Participants')}
                    />
                    <DecisionStat
                      number={invite.proposalCount}
                      label={t('Proposals')}
                    />
                  </div>
                </div>

                {/* Per-card decline link (only show if multiple invites) */}
                {invites.length > 1 && (
                  <Button
                    unstyled
                    className="self-center text-sm text-primary-teal underline hover:text-primary-teal/80 disabled:opacity-50"
                    onPress={() => handleDecline(invite.id)}
                    isDisabled={declineInvite.isPending}
                  >
                    {t("I don't want to participate")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom actions - Continue button and decline link */}
        <div className="flex flex-col items-center gap-2">
          <Button
            className="w-full"
            onPress={handleAcceptAll}
            isDisabled={isLoading || acceptInvite.isPending}
          >
            {isLoading || acceptInvite.isPending ? (
              <LoadingSpinner />
            ) : (
              t('Continue')
            )}
          </Button>
          {/* Show single decline link at bottom only for single invite */}
          {invites.length === 1 && invites[0] && (
            <Button
              unstyled
              className="h-10 px-2 py-2.5 text-sm text-primary-teal underline hover:text-primary-teal/80 disabled:opacity-50"
              onPress={() => handleDecline(invites[0]!.id)}
              isDisabled={declineInvite.isPending}
            >
              {t("I don't want to participate")}
            </Button>
          )}
        </div>
      </FormContainer>
    </div>
  );
};

const DecisionStat = ({ number, label }: { number: number; label: string }) => (
  <div className="flex items-end gap-1 sm:flex-col sm:items-center sm:gap-0">
    <span className="font-serif text-title-base">{number}</span>
    <span className="text-sm">{label}</span>
  </div>
);

export const DecisionInvitesFormSuspense = (
  props: DecisionInvitesFormProps,
) => {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense
        fallback={<DecisionInvitesSkeleton className={props.className} />}
      >
        <DecisionInvitesForm {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
