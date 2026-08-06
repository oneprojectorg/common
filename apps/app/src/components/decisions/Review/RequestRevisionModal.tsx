'use client';

import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Textarea } from '@op/sense/Textarea';
import { useState } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useReviewForm } from './ReviewFormContext';

interface RequestRevisionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEEDBACK_FIELD_ID = 'request-revision-feedback';
const FEEDBACK_DESCRIPTION_ID = 'request-revision-feedback-description';

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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setComment('');
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Request Revision')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          {/* The consequences of a revision request lead the dialog (Figma):
              alert first, then the feedback field. */}
          <Alert variant="warning">
            <LuCircleAlert />
            <AlertTitle>{t('Before you request a revision')}</AlertTitle>
            <AlertDescription>
              {t(
                'Only one revision request is allowed per proposal, and reviewing will be paused for all reviewers until the author responds.',
              )}
            </AlertDescription>
          </Alert>

          <Field>
            <FieldLabel htmlFor={FEEDBACK_FIELD_ID}>
              {t('Feedback for proposal author')}
            </FieldLabel>
            <FieldDescription id={FEEDBACK_DESCRIPTION_ID}>
              {t('Shared anonymously with the author and other reviewers.')}
            </FieldDescription>
            <Textarea
              id={FEEDBACK_FIELD_ID}
              aria-describedby={FEEDBACK_DESCRIPTION_ID}
              className="[unicode-bidi:plaintext]"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('What changes should the author make?')}
              rows={5}
            />
          </Field>
        </div>

        <DialogFooter>
          {/* Figma shows a single primary button, but an explicit Cancel stays:
              it's the only keyboard-reachable dismiss control in the footer of
              a destructive-ish flow. */}
          <Button variant="outline" onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            loading={isRequestingRevision}
          >
            {t('Request revision')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
