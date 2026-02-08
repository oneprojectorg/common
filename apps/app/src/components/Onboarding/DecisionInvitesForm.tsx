'use client';

import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Surface } from '@op/ui/Surface';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { StepProps } from '../MultiStepForm';
import { DecisionCardHeader } from '../decisions/DecisionCardHeader';
import { FormContainer } from '../form/FormContainer';
import { DecisionInvitesSkeleton } from './DecisionInvitesSkeleton';

export const validator = z.object({});

type DecisionInvitesFormProps = StepProps & {
  className?: string;
};

export const DecisionInvitesForm = ({
  onNext,
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

  // If no invites, automatically proceed to next step
  // Use sessionStorage with TTL to prevent infinite loops on remount
  useEffect(() => {
    if (invites && invites.length === 0) {
      const skipTimestamp = sessionStorage.getItem('decision-invites-skipped');
      const now = Date.now();
      // TTL of 5 seconds - just enough to prevent loop but allows retry later
      const isWithinTTL =
        skipTimestamp && now - parseInt(skipTimestamp, 10) < 5000;

      if (!isWithinTTL) {
        sessionStorage.setItem('decision-invites-skipped', now.toString());
        onNext({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invites]);

  const handleDecline = async (inviteId: string) => {
    try {
      await declineInvite.mutateAsync({ inviteId });
    } catch (error) {
      console.error('Failed to decline invite:', error);
      toast.error({
        message: t('Failed to decline invitation'),
      });
    }
  };

  const handleAcceptAll = async () => {
    if (!invites || invites.length === 0) {
      onNext({});
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
      onNext({});
    } catch (error) {
      setIsLoading(false);
      console.error('Failed to accept invitations:', error);
      toast.error({
        message: t('Failed to accept invitations'),
      });
    }
  };

  // Show skeleton while navigating away (useEffect will handle navigation)
  if (!invites || invites.length === 0) {
    return <DecisionInvitesSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-12rem)] w-full max-w-lg flex-col justify-center',
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
            const steward = profile?.processInstance?.steward;

            return (
              <div key={invite.id} className="flex flex-col gap-2">
                <Surface className="p-6">
                  <DecisionCardHeader
                    name={profile?.name ?? ''}
                    stewardName={steward?.name}
                    stewardAvatarName={steward?.avatarImage?.name}
                  />
                </Surface>

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
