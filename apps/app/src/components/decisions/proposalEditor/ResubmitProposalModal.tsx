'use client';

import { trpc } from '@op/api/client';
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
import { toast } from '@op/sense/Toast';
import { useId, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

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
  const router = useRouter();
  const commentId = useId();
  const [comment, setComment] = useState('');

  const submitRevisionResponse =
    trpc.decision.submitRevisionResponse.useMutation({
      onSuccess: () => {
        toast.success(t('Proposal resubmitted'));
        onOpenChange(false);
        setComment('');
        router.push(backHref);
      },
      onError: () => {
        toast.error(t('Failed to resubmit proposal'));
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setComment('');
        }
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Resubmit proposal')}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <Field>
            <FieldLabel htmlFor={commentId}>
              {t('What did you change?')}
            </FieldLabel>
            <FieldDescription>
              {t(
                'Briefly describe your revisions so reviewers know what to look for.',
              )}
            </FieldDescription>
            <Textarea
              id={commentId}
              rows={4}
              placeholder={t('Describe what you changed…')}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="[unicode-bidi:plaintext]"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitRevisionResponse.isPending}
          >
            {t('Resubmit proposal')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
