'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';

import { useTranslations } from '@/lib/i18n';

import { useReviewForm } from './ReviewFormContext';

interface ViewRevisionRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewRevisionRequestModal({
  isOpen,
  onOpenChange,
}: ViewRevisionRequestModalProps) {
  const t = useTranslations();
  const {
    revisionRequest,
    isOwnRevisionRequest,
    cancelRevisionRequest,
    isCancellingRevision,
  } = useReviewForm();

  const handleCancelRequest = () => {
    cancelRevisionRequest();
    onOpenChange(false);
  };

  if (!revisionRequest) {
    return null;
  }

  const sentDate = revisionRequest.requestedAt
    ? new Date(revisionRequest.requestedAt)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Request Revision')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 px-6 py-4">
          <span className="text-base text-neutral-black">
            {t('Feedback to Author')}
          </span>

          <div className="flex flex-col gap-2 rounded-lg border border-neutral-gray1 p-3">
            <p dir="auto" className="text-base text-neutral-charcoal">
              {revisionRequest.requestComment}
            </p>
            {sentDate && (
              <p className="text-sm text-neutral-gray4">
                {t('Sent {date}', {
                  date: sentDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          {isOwnRevisionRequest && (
            <Button
              variant="outline"
              onClick={handleCancelRequest}
              loading={isCancellingRevision}
            >
              {t('Cancel request')}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>{t('Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
