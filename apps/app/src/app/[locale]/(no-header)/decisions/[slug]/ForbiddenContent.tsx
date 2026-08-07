'use client';

import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { Header1, Header2 } from '@op/sense/Header';
import { toast } from '@op/sense/Toast';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DecisionInvitesSkeleton } from '@/components/Onboarding/DecisionInvitesSkeleton';
import { DecisionInviteCard } from '@/components/decisions/DecisionInviteCard';
import { FormContainer } from '@/components/form/FormContainer';

const NoAccessMessage = () => {
  const t = useTranslations();

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 text-center">
      <Header1>{t("You don't have access to this page")}</Header1>
      <p className="text-muted-foreground">
        {t(
          'Contact the person who shared this link if you think this is a mistake.',
        )}
      </p>
      <ButtonLink href="/">{t('Go to Common')}</ButtonLink>
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
      toast.error(t('Failed to accept invitations'));
    },
  });

  const declineInvite = trpc.profile.declineInvite.useMutation({
    onSuccess: () => {
      window.location.href = '/';
    },
    onError: () => {
      toast.error(t('Failed to decline invitation'));
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
            <Header1 className="text-headline">
              {t('Join {processInstanceName}', {
                processInstanceName: matchingInvite.profile?.name,
              })}
            </Header1>
            <Header2 className="font-sans text-base text-muted-foreground">
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
              onClick={() =>
                acceptInvite.mutate({ inviteId: matchingInvite.id })
              }
              disabled={acceptInvite.isPending || declineInvite.isPending}
              loading={acceptInvite.isPending}
            >
              {t('Accept')}
            </Button>
            <Button
              variant="link"
              size="inline"
              className="text-sm font-normal text-primary-teal underline hover:text-primary-teal/80"
              onClick={() =>
                declineInvite.mutate({ inviteId: matchingInvite.id })
              }
              disabled={acceptInvite.isPending || declineInvite.isPending}
              loading={declineInvite.isPending}
            >
              {t("I don't want to participate")}
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
