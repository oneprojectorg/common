'use client';

import {
  REJECTION_NOTE_MAX_LENGTH,
  RejectionReason,
  rejectionReasonSchema,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Textarea } from '@op/sense/Textarea';
import { useId, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { LabeledFieldSet } from './forms/LabeledFieldSet';

/**
 * The enum values are wire constants, so the chips need their English copy
 * looked up. `satisfies` is what makes a new reason fail to compile until it
 * has one.
 *
 * `Duplicate_noun` is deliberately not the English string: `Duplicate` is
 * already taken by the verb on the decision menu, and the two senses translate
 * differently (Spanish: `Duplicada` vs `Duplicar`).
 */
const REJECTION_REASON_LABEL_KEYS = {
  [RejectionReason.INELIGIBLE]: 'Ineligible',
  [RejectionReason.DUPLICATE]: 'Duplicate_noun',
  [RejectionReason.OFF_TOPIC]: 'Off-topic',
  [RejectionReason.INFEASIBLE]: 'Infeasible',
} as const satisfies Record<RejectionReason, string>;

/**
 * Reject-proposal form, shared by the card kebab and the proposal-page overflow
 * menu. Presentational: the caller owns the reject mutation (via
 * {@link useProposalRejectionActions}) and passes `onConfirm` + its pending
 * state, so the toast-with-undo and the menu's Undo item stay on one code path.
 *
 * Neither the reason nor the note is stored — both exist to reach the author's
 * rejection email, which is why the confirm button says so.
 */
export const RejectProposalDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { reason: RejectionReason; note: string }) => void;
  isPending: boolean;
}) => {
  const t = useTranslations();
  // One dialog per proposal card, so the radio and textarea ids must not collide.
  const fieldId = useId();
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [note, setNote] = useState('');

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // The content unmounts, so state would otherwise survive into the next open.
      setReason(null);
      setNote('');
    }
    onOpenChange(nextOpen);
  };

  // The confirm button is disabled without a reason; this is the type's half.
  const handleConfirm = () => {
    if (reason) {
      onConfirm({ reason, note });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Wide enough for the four reasons to sit on one row, as in Figma. */}
      <DialogContent className="sm:max-w-144">
        <DialogHeader>
          <DialogTitle>{t('Do not advance')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <LabeledFieldSet legend={t('Reason')} legendId={`${fieldId}-reason`}>
            <RadioGroup
              // A <legend> does not name a nested role="radiogroup".
              aria-labelledby={`${fieldId}-reason`}
              value={reason}
              onValueChange={(value) => {
                const parsed = rejectionReasonSchema.safeParse(value);

                if (parsed.success) {
                  setReason(parsed.data);
                }
              }}
              // Figma lays the reasons out as chips on one row; they wrap rather
              // than squeeze, since a translated label can be twice as long.
              className="flex flex-row flex-wrap"
            >
              {Object.values(RejectionReason).map((value) => {
                const optionId = `${fieldId}-${value}`;

                return (
                  <OptionBox
                    key={value}
                    htmlFor={optionId}
                    width="hug"
                    label={t(REJECTION_REASON_LABEL_KEYS[value])}
                    control={<RadioGroupItem id={optionId} value={value} />}
                  />
                );
              })}
            </RadioGroup>
          </LabeledFieldSet>

          <Field>
            <FieldLabel htmlFor={`${fieldId}-note`}>
              {t('Note to proposal author')}
            </FieldLabel>
            <Textarea
              id={`${fieldId}-note`}
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
            disabled={isPending}
          >
            {t('Cancel')}
          </Button>
          {/* Figma uses the primary button here, not the destructive one. */}
          <Button
            className="w-full sm:w-auto"
            onClick={handleConfirm}
            disabled={!reason || isPending}
          >
            {isPending ? t('Rejecting...') : t('Reject & send note')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
