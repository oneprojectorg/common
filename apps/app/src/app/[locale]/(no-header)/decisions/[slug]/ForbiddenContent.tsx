'use client';

import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { Header1, Header2 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { DecisionInvitesSkeleton } from '@/components/Onboarding/DecisionInvitesSkeleton';
import { DecisionInviteCard } from '@/components/decisions/DecisionInviteCard';
import { FormContainer } from '@/components/form/FormContainer';

const NoAccessMessage = () => {
  const t = useTranslations();

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 text-center">
      <Header1>{t("You don't have access to this page")}</Header1>
      <p className="text-neutral-gray4">
        {t(
          'Contact the person who shared this link if you think this is a mistake.',
        )}
      </p>
      <ButtonLink href="/" color="primary">
        {t('Go to Common')}
      </ButtonLink>
    </div>
  );
};

const ForbiddenWithInviteCheck = () => {
  const t = useTranslations();
  const { slug } = useParams<{ slug: string }>();

  const [invites] = trpc.account.listUserInvites.useSuspenseQuery(
    {
      entityType: EntityType.DECISION,
      pending: true,
    },
    {
      staleTime: 0,
      refetchOnMount: 'always',
    },
  );

  const acceptInvite = trpc.profile.acceptInvite.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
    onError: () => {
      toast.error({
        message: t('Failed to accept invitations'),
      });
    },
  });

  const declineInvite = trpc.profile.declineInvite.useMutation({
    onSuccess: () => {
      window.location.href = '/';
    },
    onError: () => {
      toast.error({
        message: t('Failed to decline invitation'),
      });
    },
  });

  const matchingInvite = invites.find(
    (invite) => invite.profile?.slug === slug,
  );

  if (!matchingInvite) {
    return <NoAccessMessage />;
  }

  const steward = matchingInvite.profile?.processInstance?.steward;

  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="flex w-full max-w-lg flex-col justify-center">
        <FormContainer className="gap-6">
          <div className="flex flex-col gap-2 text-center">
            <Header1 className="font-serif">
              {t('Join {processInstanceName}', {
                processInstanceName: matchingInvite.profile?.name,
              })}
            </Header1>
            <Header2 className="text-neutral-gray4">
              {t('A decision-making process stewarded by {stewardName}.', {
                stewardName: steward?.name ?? '',
              })}
            </Header2>
          </div>

          <DecisionInviteCard
            invite={matchingInvite}
            onDecline={() =>
              declineInvite.mutate({ inviteId: matchingInvite.id })
            }
            isAccepting={acceptInvite.isPending}
            isDeclining={declineInvite.isPending}
            showDecline={false}
          />

          <div className="flex flex-col items-center gap-2">
            <Button
              className="w-full"
              onPress={() =>
                acceptInvite.mutate({ inviteId: matchingInvite.id })
              }
              isDisabled={acceptInvite.isPending || declineInvite.isPending}
            >
              {acceptInvite.isPending ? <LoadingSpinner /> : t('Accept')}
            </Button>
            <Button
              unstyled
              className="h-10 px-2 py-2.5 text-sm text-primary-teal underline hover:text-primary-teal/80 disabled:opacity-50"
              onPress={() =>
                declineInvite.mutate({ inviteId: matchingInvite.id })
              }
              isDisabled={acceptInvite.isPending || declineInvite.isPending}
            >
              {declineInvite.isPending ? (
                <LoadingSpinner />
              ) : (
                t("I don't want to participate")
              )}
            </Button>
          </div>
        </FormContainer>
      </div>
    </div>
  );
};

export const ForbiddenContent = () => {
  return (
    <ErrorBoundary fallback={<NoAccessMessage />}>
      <Suspense
        fallback={
          <div className="flex size-full flex-col items-center justify-center">
            <DecisionInvitesSkeleton />
          </div>
        }
      >
        <ForbiddenWithInviteCheck />
      </Suspense>
    </ErrorBoundary>
  );
};
