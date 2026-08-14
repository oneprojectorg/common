import { useRequiredUser } from '@/utils/UserProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UpdateProfileForm } from './UpdateProfileForm';

export const UpdateProfileModal = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  const { user } = useRequiredUser();
  const t = useTranslations();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Edit Profile')}</DialogTitle>
        </DialogHeader>
        {user.profile && (
          <UpdateProfileForm
            ref={formRef}
            profile={user.profile}
            onSuccess={() => setIsOpen(false)}
            className="p-6"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
