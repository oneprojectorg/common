'use client';

import { getPublicUrl } from '@/utils';
import { Button } from '@op/sense/Button';
import { Header2 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Spinner } from '@op/sense/Spinner';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n';

type ProfileWithAvatar = {
  name?: string | null;
  avatarImage?: { name?: string | null } | null;
};

type Invite = {
  id: string;
  participantCount: number;
  proposalCount: number;
  profile?: {
    name?: string | null;
    processInstance?: {
      steward?: ProfileWithAvatar | null;
    } | null;
  } | null;
};

type DecisionInviteCardProps = {
  invite: Invite;
  onDecline: (inviteId: string) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  showDecline?: boolean;
};

export const DecisionInviteCard = ({
  invite,
  onDecline,
  isAccepting,
  isDeclining,
  showDecline = true,
}: DecisionInviteCardProps) => {
  const t = useTranslations();
  const { profile } = invite;
  const processInstance = profile?.processInstance;
  const steward = processInstance?.steward;
  if (!profile || !processInstance || !steward) {
    throw new Error('Invite is missing profile, process instance, or steward');
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Header2 className="font-serif">{profile.name}</Header2>
          <ProfileItem
            size="small"
            className="items-center gap-1"
            titleClassName="text-foreground"
            avatar={
              <ProfileAvatar
                name={steward?.name ?? ''}
                src={
                  steward?.avatarImage?.name
                    ? getPublicUrl(steward.avatarImage.name)
                    : undefined
                }
                alt={steward?.name ?? 'Steward avatar'}
                className="size-4 shrink-0"
                imageRender={
                  steward?.avatarImage?.name ? (
                    <Image
                      src={getPublicUrl(steward.avatarImage.name) ?? ''}
                      alt={steward.name ?? 'Steward avatar'}
                      fill
                      className="object-cover"
                    />
                  ) : undefined
                }
              />
            }
            title={steward?.name ?? ''}
          />
        </div>
        <div className="flex items-end gap-4 text-neutral-black sm:items-center sm:gap-12">
          <DecisionStat
            number={invite.participantCount}
            label={t('Participants')}
          />
          <DecisionStat number={invite.proposalCount} label={t('Proposals')} />
        </div>
      </div>

      {showDecline && (
        <Button
          variant="link"
          className="h-auto self-center p-0 text-sm font-normal text-primary-teal underline hover:text-primary-teal/80"
          onClick={() => onDecline(invite.id)}
          disabled={isDeclining || isAccepting}
        >
          {isDeclining ? (
            <Spinner className="size-4" />
          ) : (
            t("I don't want to participate")
          )}
        </Button>
      )}
    </div>
  );
};

const DecisionStat = ({ number, label }: { number: number; label: string }) => (
  <div className="flex items-end gap-1 sm:flex-col sm:items-center sm:gap-0">
    <span className="font-serif text-title-base">{number}</span>
    <span className="text-sm">{label}</span>
  </div>
);
