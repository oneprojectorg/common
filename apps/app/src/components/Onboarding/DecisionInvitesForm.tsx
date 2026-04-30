'use client';

import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import { ReactNode, Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { DecisionInviteCard } from '../decisions/DecisionInviteCard';
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
          <Header1 className="text-foreground">
            {t('Join decision-making processes')}
          </Header1>
          <p className="text-sm text-muted-foreground">
            {t(
              "You've been invited to join the following decision-making processes",
            )}
          </p>
        </div>

        {/* List of invite cards */}
        <div className="flex flex-col gap-6">
          {invites.map((invite) => (
            <DecisionInviteCard
              key={invite.id}
              invite={invite}
              onDecline={handleDecline}
              isAccepting={false}
              isDeclining={declineInvite.isPending}
              showDecline={invites.length > 1}
            />
          ))}
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
              className="h-10 px-2 py-2.5 text-sm text-primary underline hover:text-primary/80 disabled:opacity-50"
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
