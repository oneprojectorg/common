'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ProfileItem } from '@op/ui/ProfileItem';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { DecisionInvitesSkeleton } from '@/components/Onboarding/DecisionInvitesSkeleton';
import { FormContainer } from '@/components/form/FormContainer';

const DecisionStat = ({ number, label }: { number: number; label: string }) => (
  <div className="flex items-end gap-1 sm:flex-col sm:items-center sm:gap-0">
    <span className="font-serif text-title-base">{number}</span>
    <span className="text-sm">{label}</span>
  </div>
);

const NoAccessMessage = () => {
  const t = useTranslations();

  return (
    <div className="flex size-full flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <Header2 className="font-serif text-[4rem] leading-[110%] font-light">
          403
        </Header2>
        <p className="text-center">
          {t('You do not have permission to view this page')}
        </p>
      </div>
      <Button onPress={() => window.history.back()} color="primary">
        {t('Go back')}
      </Button>
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

  const matchingInvite = invites.find(
    (invite) => invite.profile?.slug === slug,
  );

  if (!matchingInvite) {
    return <NoAccessMessage />;
  }

  const profile = matchingInvite.profile;
  const processInstance = profile?.processInstance;
  const steward = processInstance?.steward;

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

  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="flex w-full max-w-lg flex-col justify-center">
        <FormContainer className="gap-6">
          <div className="flex flex-col gap-2 text-center">
            <Header2 className="text-neutral-black">
              {t('You have been invited to this decision')}
            </Header2>
          </div>

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
                number={matchingInvite.participantCount}
                label={t('Participants')}
              />
              <DecisionStat
                number={matchingInvite.proposalCount}
                label={t('Proposals')}
              />
            </div>
          </div>

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

export default function Forbidden() {
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
}
