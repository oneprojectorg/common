import { Profile } from '@op/api/encoders';
import { Modal, ModalHeader } from '@op/ui-next/Modal';

import { useTranslations } from '@/lib/i18n';

import type { User } from '../types';
import { UpdateProfileForm } from './UpdateProfileForm';

export const UpdateProfileModal = ({
  authUserId,
  profile,
  isOpen,
  onOpenChange,
  onSuccess,
}: {
  authUserId: User['authUserId'];
  profile: Profile;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
}) => {
  const t = useTranslations();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Edit Profile')}</ModalHeader>
      <UpdateProfileForm
        authUserId={authUserId}
        profile={profile}
        onSuccess={() => {
          onSuccess();
          onOpenChange(false);
        }}
        className="p-6"
      />
    </Modal>
  );
};
