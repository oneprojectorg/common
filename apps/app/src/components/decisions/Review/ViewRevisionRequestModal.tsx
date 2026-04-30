'use client';

import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Revision request')}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-2">
          <span className="text-base text-foreground">
            {t('Feedback for proposal author')}
          </span>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
            <p className="text-base text-foreground">
              {revisionRequest.requestComment}
            </p>
            {sentDate && (
              <p className="text-sm text-muted-foreground">
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
      </ModalBody>
      <ModalFooter>
        {isOwnRevisionRequest && (
          <Button
            color="secondary"
            onPress={handleCancelRequest}
            isDisabled={isCancellingRevision}
          >
            {isCancellingRevision ? (
              <LoadingSpinner className="size-4" />
            ) : null}
            {t('Cancel request')}
          </Button>
        )}
        <Button color="primary" onPress={() => onOpenChange(false)}>
          {t('Close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
