'use client';

import { getPublicUrl } from '@/utils';
import { Avatar } from '@op/ui/Avatar';
import { UnstyledButton } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ProfileItem } from '@op/ui/ProfileItem';
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
          <Header2 className="font-serif text-title-base">
            {profile.name}
          </Header2>
          <ProfileItem
            size="sm"
            className="items-center gap-1"
            avatar={
              <Avatar
                placeholder={steward?.name ?? ''}
                className="size-4 shrink-0"
              >
                {steward?.avatarImage?.name ? (
                  <Image
                    src={getPublicUrl(steward.avatarImage.name) ?? ''}
                    alt={steward.name ?? 'Steward avatar'}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </Avatar>
            }
            title={steward?.name ?? ''}
          />
        </div>
        <div className="flex items-end gap-4 text-foreground sm:items-center sm:gap-12">
          <DecisionStat
            number={invite.participantCount}
            label={t('Participants')}
          />
          <DecisionStat number={invite.proposalCount} label={t('Proposals')} />
        </div>
      </div>

      {showDecline && (
        <UnstyledButton
          className="self-center text-sm text-primary underline hover:text-primary/80 disabled:opacity-50"
          onPress={() => onDecline(invite.id)}
          isDisabled={isDeclining || isAccepting}
        >
          {isDeclining ? <LoadingSpinner /> : t("I don't want to participate")}
        </UnstyledButton>
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
