'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

interface ResubmitProposalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  revisionRequestId: string;
  backHref: string;
}

export function ResubmitProposalModal({
  isOpen,
  onOpenChange,
  revisionRequestId,
  backHref,
}: ResubmitProposalModalProps) {
  const t = useTranslations();
  const [comment, setComment] = useState('');

  const submitRevisionResponse =
    trpc.decision.submitRevisionResponse.useMutation({
      onSuccess: () => {
        toast.success({ title: t('Proposal resubmitted') });
        onOpenChange(false);
        setComment('');
        window.location.href = backHref;
      },
      onError: () => {
        toast.error({ title: t('Failed to resubmit proposal') });
      },
    });

  const handleSubmit = () => {
    submitRevisionResponse.mutate({
      revisionRequestId,
      resubmitComment: comment.trim() || undefined,
    });
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
      <ModalHeader>{t('Resubmit proposal')}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-base text-neutral-black">
              {t('What did you change?')}
            </span>
            <span className="text-sm text-neutral-gray4">
              {t(
                'Briefly describe your revisions so reviewers know what to look for.',
              )}
            </span>
          </div>

          <TextField
            aria-label={t('What did you change?')}
            value={comment}
            onChange={setComment}
            useTextArea
            textareaProps={{
              rows: 4,
            }}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onPress={handleCancel}>
          {t('Cancel')}
        </Button>
        <Button
          color="primary"
          onPress={handleSubmit}
          isDisabled={submitRevisionResponse.isPending}
        >
          {submitRevisionResponse.isPending ? (
            <LoadingSpinner className="size-4" />
          ) : null}
          {t('Resubmit proposal')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
