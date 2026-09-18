'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useLocale } from 'next-intl';
import { LuHistory } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface RestoreProposalVersionModalProps {
  isOpen: boolean;
  isPending: boolean;
  versionDate: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirms restoring a saved proposal version before mutating the live draft.
 */
export function RestoreProposalVersionModal({
  isOpen,
  isPending,
  versionDate,
  onClose,
  onConfirm,
}: RestoreProposalVersionModalProps) {
  const locale = useLocale();
  const t = useTranslations('decisions.proposals');

  const formattedDate = formatDate(versionDate, locale, DATE_TIME_UTC_FORMAT);

  return (
    <Dialog
      open={isOpen}
      // A restore is in flight — don't let an outside press strand the mutation
      // behind a closed dialog (the Escape/close paths are guarded below).
      disablePointerDismissal={isPending}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader className="flex-row items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
          >
            <LuHistory className="size-5 rtl:-scale-x-100" />
          </span>
          <DialogTitle>{t('restoreVersionTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4 text-base">
          <p>
            {t.rich('restoreVersionDescription', {
              date: formattedDate,
              bold: (chunks: React.ReactNode) => (
                <span className="font-bold">{chunks}</span>
              ),
            })}
          </p>
          <p>{t('restoreVersionReassurance')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('keepCurrentVersionAction')}
          </Button>
          <Button onClick={onConfirm} loading={isPending}>
            {t('restoreAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
