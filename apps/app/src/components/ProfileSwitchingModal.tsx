'use client';

import { getPublicUrl } from '@/utils';
import { Avatar } from '@op/ui/Avatar';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal } from '@op/ui/Modal';
import Image from 'next/image';
import { ReactNode } from 'react';

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
  const avatarContent: ReactNode = avatarImage?.name ? (
    <Image
      src={getPublicUrl(avatarImage.name) ?? ''}
      alt={`${profileName} avatar`}
      fill
      className="object-cover"
    />
  ) : null;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false}>
      <div className="gap-6 p-12 flex flex-col items-center justify-center">
        <div className="size-28 relative flex">
          <Avatar placeholder={profileName} className="size-full">
            {avatarContent}
          </Avatar>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <LoadingSpinner color="teal" size="md" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-neutral-black">Switching to {profileName}…</p>
        </div>
      </div>
    </Modal>
  );
};
