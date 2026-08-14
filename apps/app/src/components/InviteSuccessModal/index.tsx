'use client';

import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import type { ReactNode } from 'react';
import { LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface InviteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteMore: () => void;
  invitedEmail?: string;
  invitedCount?: number;
  organizationName: string;
}

export const InviteSuccessModal = ({
  isOpen,
  onClose,
  onInviteMore,
  invitedEmail,
  invitedCount,
  organizationName,
}: InviteSuccessModalProps) => {
  const t = useTranslations();
  const bold = (chunks: ReactNode) => (
    <span className="font-semibold">{chunks}</span>
  );

  return (
    // No `onOpenChange`, as before: the two buttons are the only way out, so a
    // close affordance would be dead.
    <Dialog open={isOpen}>
      {/* No header or footer to pin, so centre the card in the mobile sheet
          rather than leaving it stranded at the top. */}
      <DialogContent
        showCloseButton={false}
        className="justify-center shadow-green"
      >
        <div className="flex flex-col items-center justify-center gap-6 p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-4">
            {/* Same mark as before, now on the success tokens. */}
            <div
              aria-hidden
              className="flex size-16 items-center justify-center rounded-full bg-success-muted"
            >
              <LuCheck className="size-8 text-success" />
            </div>
            <DialogTitle className="text-display font-light">
              {t('Sent')}
            </DialogTitle>
          </div>
          <p>
            {invitedCount && invitedCount > 1
              ? t.rich(
                  "You've invited <bold>{count, plural, one {# person} other {# people}}</bold> to join <bold>{organization}</bold>.",
                  { bold, count: invitedCount, organization: organizationName },
                )
              : t.rich(
                  "You've invited <bold>{email}</bold> to join <bold>{organization}</bold>.",
                  {
                    bold,
                    email: invitedEmail ?? '',
                    organization: organizationName,
                  },
                )}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={onClose} className="w-full">
              {t('Done')}
            </Button>
            <Button
              variant="secondary"
              onClick={onInviteMore}
              className="w-full"
            >
              {t('Invite more people')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
