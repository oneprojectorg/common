'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProcessAdminsPanel } from './ProcessAdminsPanel';

/** The draft bar's "Manage admins" button and the dialog it opens. A live process manages admins from Settings. */
export function ProcessAdminsDialog({ profileId }: { profileId: string }) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" />}>
        <LuUserPlus className="size-4" aria-hidden />
        {t('manageAdminsAction')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('manageAdminsAction')}</DialogTitle>
          <DialogDescription>{t('manageAdminsDescription')}</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <ProcessAdminsPanel profileId={profileId} />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {tShared('Done')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
