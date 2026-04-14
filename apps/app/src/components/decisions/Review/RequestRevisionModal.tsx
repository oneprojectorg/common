'use client';

import { AlertBanner } from '@op/ui/AlertBanner';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useReviewForm } from './ReviewFormContext';

interface RequestRevisionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestRevisionModal({
  isOpen,
  onOpenChange,
}: RequestRevisionModalProps) {
  const t = useTranslations();
  const { requestRevision, isRequestingRevision } = useReviewForm();
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (!comment.trim()) {
      return;
    }
    requestRevision(comment);
    onOpenChange(false);
    setComment('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    setComment('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setComment('');
        }
        onOpenChange(open);
      }}
      isDismissable
    >
      <ModalHeader>{t('Request revision')}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-base text-neutral-black">
              {t('Feedback for proposal author')}
            </span>
            <span className="text-sm text-neutral-black">
              {t(
                'This feedback will be shared with the proposal author and admins.',
              )}
            </span>
          </div>

          <TextField
            aria-label={t('Feedback for proposal author')}
            value={comment}
            onChange={setComment}
            useTextArea
            textareaProps={{
              placeholder: t('What changes should the author make?'),
              rows: 5,
            }}
          />
        </div>

        <AlertBanner
          intent="warning"
          variant="banner"
          icon={<LuCircleAlert className="size-4" />}
        >
          {t('Reviewing will be paused until a revision is submitted.')}
        </AlertBanner>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onPress={handleCancel}>
          {t('Cancel')}
        </Button>
        <Button
          color="primary"
          onPress={handleSubmit}
          isDisabled={!comment.trim() || isRequestingRevision}
        >
          {isRequestingRevision ? <LoadingSpinner className="size-4" /> : null}
          {t('Request revision')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
