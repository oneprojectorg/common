'use client';

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

        <div className="flex flex-col gap-4 px-6 pt-6 pb-8">
          <Field>
            <FieldLabel htmlFor={FEEDBACK_FIELD_ID}>
              {t('What should the author change?')}
            </FieldLabel>
            <FieldDescription id={FEEDBACK_DESCRIPTION_ID}>
              {t('Shared anonymously with the author and other reviewers.')}
            </FieldDescription>
            <Textarea
              id={FEEDBACK_FIELD_ID}
              aria-describedby={FEEDBACK_DESCRIPTION_ID}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("Describe what's unclear or missing")}
              rows={6}
            />
          </Field>
        </div>

        <DialogFooter>
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
