'use client';

import { useMaybeUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { Header1, Header2 } from '@op/sense/Header';
import { toast } from '@op/sense/Toast';
import { useParams, usePathname } from 'next/navigation';
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
    <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
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

/**
 * Shown to a visitor with no real account.
 *
 * `/login` sits outside the `[locale]` tree, so this links with a native
 * anchor rather than `ButtonLink` — the i18n `Link` would prefix the locale
 * and land on a route that doesn't exist. The redirect target uses
 * `next/navigation`'s `usePathname` (not the i18n one) for the mirror-image
 * reason: it keeps the locale prefix that `getSafeRedirectPath` requires
 * before login will send them back here.
 */
const SignInMessage = () => {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Header1>{t('Sign in to view this page')}</Header1>
      <p className="text-muted-foreground">
        {t('This page is only visible to people taking part in this decision.')}
      </p>
      <Button
        nativeButton={false}
        role={undefined}
        render={
          <a href={`/login?redirect=${encodeURIComponent(pathname)}`}>
            {t('Sign in')}
          </a>
        }
      />
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
    <div className="flex size-full flex-col items-center justify-center p-6">
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
              className="text-sm font-normal text-primary underline hover:text-primary/80"
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
  // Non-throwing: this renders from a `forbidden.tsx` boundary, where a hook
  // that threw would escalate the scoped page into a generic error.
  const user = useMaybeUser();

  // A signed-out visitor (or an anonymous account) hasn't been refused — they
  // just haven't identified themselves yet, which is how most people arrive on
  // a shared decision or proposal link. Invites are keyed to a real account, so
  // the lookup below has nothing to find and would only 401 into the generic
  // "no access" fallback. Send them to sign in and back instead.
  if (!userCanInteract(user)) {
    return <SignInMessage />;
  }

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
