'use client';

import { trpc } from '@op/api/client';
import {
  PROPOSAL_REJECTION_REASONS,
  type ProposalRejectionReason,
  REJECTION_NOTE_MAX_LENGTH,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Label } from '@op/sense/Label';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

/**
 * "Reject Proposal" — pick a reason (required) and optionally send a note to the
 * author, then move the proposal to `REJECTED`. The reason/note aren't persisted
 * yet (ONE-931); the status change is the durable effect and re-badges the card
 * as "Not shortlisted".
 *
 * Always controlled: open it via `onOpenChange`.
 */
export function RejectProposalDialog({
  proposalId,
  open,
  onOpenChange,
  onRejected,
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after a successful reject — e.g. leave the page you just rejected. */
  onRejected?: () => void;
}) {
  const t = useTranslations();
  const [reason, setReason] = useState<ProposalRejectionReason | null>(null);
  const [note, setNote] = useState('');

  // No invalidation needed: the endpoint registers the affected proposal channels.
  const rejectMutation = trpc.decision.rejectProposal.useMutation({
    onError: (error) => {
      toast.error(
        error.message || t('Could not reject this proposal. Please try again.'),
      );
    },
  });

  const reasonLabels: Record<ProposalRejectionReason, string> = {
    ineligible: t('Ineligible'),
    duplicate: t('Duplicate'),
    off_topic: t('Off-topic'),
    infeasible: t('Infeasible'),
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // The content unmounts, so state would otherwise survive into the next open.
      setReason(null);
      setNote('');
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!reason) {
      return;
    }

    try {
      await rejectMutation.mutateAsync(
        { proposalId, reason, note },
        {
          onSuccess: () => toast.success(t('Proposal rejected')),
        },
      );
      handleOpenChange(false);
      onRejected?.();
    } catch (error) {
      // Already toasted by `onError`; staying open keeps the reason for a retry.
      logger.error('Failed to reject proposal', {
        error,
        context: 'RejectProposalDialog',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-116">
        <DialogHeader>
          <DialogTitle>{t('Reject Proposal')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            {/* A radiogroup label, not an input label: a plain element referenced
                via aria-labelledby, so it isn't an orphan <label>. */}
            <span id="reject-reason-label" className="font-medium">
              {t('Reason')}
            </span>
            <RadioGroup
              aria-labelledby="reject-reason-label"
              value={reason}
              onValueChange={(value) => {
                // Narrow the primitive back to the union without a cast.
                const next = PROPOSAL_REJECTION_REASONS.find(
                  (candidate) => candidate === value,
                );
                if (next) {
                  setReason(next);
                }
              }}
              className="flex flex-row flex-wrap gap-2"
            >
              {PROPOSAL_REJECTION_REASONS.map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`reject-reason-${value}`} />
                  <Label htmlFor={`reject-reason-${value}`}>
                    {reasonLabels[value]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="reject-note">
              {t('Note to proposal author')}{' '}
              <span className="font-normal text-muted-foreground">
                {t('Optional')}
              </span>
            </FieldLabel>
            <Textarea
              id="reject-note"
              value={note}
              maxLength={REJECTION_NOTE_MAX_LENGTH}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t(
                'Write an optional note to the proposal author here',
              )}
              className="min-h-24"
            />
            <FieldDescription>
              {t('The author will receive this note as soon as you reject.')}
            </FieldDescription>
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => handleOpenChange(false)}
            disabled={rejectMutation.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handleConfirm}
            disabled={!reason}
            loading={rejectMutation.isPending}
          >
            {t('Reject & send note')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
