import { Profile } from '@op/api/encoders';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Edit Profile')}</DialogTitle>
        </DialogHeader>
        <UpdateProfileForm
          authUserId={authUserId}
          profile={profile}
          onSuccess={() => {
            onSuccess();
            onOpenChange(false);
          }}
          className="p-6"
        />
      </DialogContent>
    </Dialog>
  );
};
