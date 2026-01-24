import type { Profile } from '@op/api/encoders';
import { Dialog } from '@op/ui/Dialog';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';

import { useTranslations } from '@/lib/i18n';

import type { User } from '../types';
import { UpdateProfileForm } from './UpdateProfileForm';

/**
 * Modal for editing a user's profile in the platform admin interface.
 * Wraps the UpdateProfileForm with modal UI and handles open/close state.
 */
export const UpdateProfileModal = ({
  userId,
  authUserId,
  profile,
  isOpen,
  onOpenChange,
  onSuccess,
}: {
  /** The user's internal ID (collection key) */
  userId: User['id'];
  /** The user's auth ID (for the mutation) */
  authUserId: User['authUserId'];
  profile: Profile;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
}) => {
  const t = useTranslations();

  return (
    <DialogTrigger>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
        <Dialog>
          <ModalHeader>{t('Edit Profile')}</ModalHeader>
          <UpdateProfileForm
            userId={userId}
            authUserId={authUserId}
            profile={profile}
            onSuccess={() => {
              onSuccess();
              onOpenChange(false);
            }}
            className="p-6"
          />
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
