'use client';

import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import { LuCheck } from 'react-icons/lu';

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
  return (
    // No `onOpenChange`, as before: the two buttons are the only way out, so a
    // close affordance would be dead.
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        className="shadow-green inset-shadow-none"
      >
        <div className="flex flex-col items-center justify-center gap-6 p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-4">
            {/* Was an @op/ui SVG with baked-in hex; same mark, on the success
                tokens. */}
            <div
              aria-hidden
              className="flex size-16 items-center justify-center rounded-full bg-success-muted"
            >
              <LuCheck className="size-8 text-success" />
            </div>
            <DialogTitle className="text-display font-light">Sent</DialogTitle>
          </div>
          <p>
            {invitedCount && invitedCount > 1 ? (
              <>
                You've invited{' '}
                <span className="font-semibold">{invitedCount} people</span> to
                join <span className="font-semibold">{organizationName}</span>.
              </>
            ) : (
              <>
                You've invited{' '}
                <span className="font-semibold">{invitedEmail}</span> to join{' '}
                <span className="font-semibold">{organizationName}</span>.
              </>
            )}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
            <Button
              variant="secondary"
              onClick={onInviteMore}
              className="w-full"
            >
              Invite more people
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
