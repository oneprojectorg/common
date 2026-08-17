'use client';

import { getPublicUrl } from '@/utils';
import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Spinner } from '@op/sense/Spinner';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n';

interface ProfileSwitchingModalProps {
  isOpen: boolean;
  avatarImage?: {
    name: string;
  } | null;
  profileName?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export const ProfileSwitchingModal = ({
  isOpen,
  avatarImage,
  profileName,
  onOpenChange,
}: ProfileSwitchingModalProps) => {
  const t = useTranslations();
  const avatarUrl = getPublicUrl(avatarImage?.name);
  const switchingTo = t('Switching to {name}…', { name: profileName ?? '' });

  return (
    // `disablePointerDismissal`: the switch is in flight and closing this would
    // leave the header showing the profile the user just left.
    <Dialog open={isOpen} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="justify-center sm:max-w-sm"
      >
        <div className="flex flex-col items-center justify-center gap-6 p-12">
          <div className="relative flex size-28">
            <ProfileAvatar
              name={profileName}
              src={avatarUrl}
              alt={switchingTo}
              className="size-full"
              imageRender={
                avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={switchingTo}
                    fill
                    className="object-cover"
                  />
                ) : undefined
              }
            />
            <div className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Spinner />
            </div>
          </div>
          <DialogTitle className="text-center text-base">
            {switchingTo}
          </DialogTitle>
        </div>
      </DialogContent>
    </Dialog>
  );
};
