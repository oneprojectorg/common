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
import { LuCircleAlert } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

interface ResubmitProposalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  backHref: string;
}

/**
 * One note answers every request open on the proposal, so this dialog asks the
 * author for a single note rather than a reply per request.
 */
export function ResubmitProposalModal({
  isOpen,
  onOpenChange,
  proposalId,
  backHref,
}: ResubmitProposalModalProps) {
  const t = useTranslations('decisions.proposals');
  const router = useRouter();
  const noteId = useId();
  const noteDescriptionId = useId();
  const noteHintId = useId();
  const [note, setNote] = useState('');

  const submitProposalRevision =
    trpc.decision.submitProposalRevision.useMutation({
      onSuccess: () => {
        toast.success(t('resubmitSuccess'));
        onOpenChange(false);
        setNote('');
        router.push(backHref);
      },
      onError: () => {
        toast.error(t('resubmitError'));
      },
    });

  const trimmedNote = note.trim();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setNote('');
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('submitRevisionAction')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-6">
          <Field>
            <FieldLabel htmlFor={noteId}>{t('revisionNoteLabel')}</FieldLabel>
            <FieldDescription id={noteDescriptionId}>
              {t('revisionNoteHint')}
            </FieldDescription>
            {/* `Field` does not wire `aria-describedby` itself, so the hint
                below the field is listed here too — it states the one-shot
                consequence of submitting, which a screen reader user needs
                before the control, not after it. */}
            <Textarea
              id={noteId}
              aria-describedby={`${noteDescriptionId} ${noteHintId}`}
              rows={6}
              placeholder={t('revisionNotePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <p
            id={noteHintId}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <LuCircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('resubmitFinalWarning')}
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              submitProposalRevision.mutate({ proposalId, note: trimmedNote })
            }
            disabled={trimmedNote.length === 0}
            loading={submitProposalRevision.isPending}
          >
            {t('submitRevisionAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
