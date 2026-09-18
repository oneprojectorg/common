'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionPhase,
  CustomFormWithPhaseDTO,
} from '@op/common/client';
import { customFormDefinitionInputSchema } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { useId, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { type TranslateFn, useTranslations } from '@/lib/i18n';

import { CustomFormFieldEditor } from './CustomFormFieldEditor';
import type { BuilderField, BuilderForm } from './formDefinition';
import {
  CHOICE_FIELD_KINDS,
  buildDefinition,
  createEmptyField,
  createEmptyForm,
  deriveFieldKey,
  parseDefinition,
} from './formDefinition';

interface CustomFormBuilderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The decision process's own profile — what the form attaches to. */
  profileId: string;
  phases: AdminDecisionPhase[];
  /** Phases already holding a form, excluding the one being edited. */
  occupiedPhaseIds: string[];
  /** The form being edited; absent when authoring a new one. */
  form?: CustomFormWithPhaseDTO;
}

export const CustomFormBuilderDialog = ({
  isOpen,
  onOpenChange,
  profileId,
  phases,
  occupiedPhaseIds,
  form,
}: CustomFormBuilderDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {/* Keyed and mounted only while open, so the draft starts from the
            form being opened rather than whatever was edited last. */}
        {isOpen ? (
          <BuilderContent
            key={form?.id ?? 'new'}
            onOpenChange={onOpenChange}
            profileId={profileId}
            phases={phases}
            occupiedPhaseIds={occupiedPhaseIds}
            form={form}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const BuilderContent = ({
  onOpenChange,
  profileId,
  phases,
  occupiedPhaseIds,
  form,
}: Omit<CustomFormBuilderDialogProps, 'isOpen'>) => {
  const t = useTranslations();
  const fieldId = useId();

  const initial = form
    ? parseDefinition({
        schema: form.schema,
        phaseId: form.phaseId ?? phases[0]?.phaseId ?? '',
        name: form.name,
      })
    : {
        form: createEmptyForm(
          firstFreePhaseId({ phases, occupiedPhaseIds }) ?? '',
        ),
        unsupportedKeys: [],
      };

  const [draft, setDraft] = useState<BuilderForm>(initial.form);
  const [errors, setErrors] = useState<string[]>([]);

  const createForm = trpc.customForm.create.useMutation();
  const updateForm = trpc.customForm.update.useMutation();
  const isSaving = createForm.isPending || updateForm.isPending;

  const handleSave = () => {
    const parsed = customFormDefinitionInputSchema.safeParse(
      buildDefinition(draft),
    );

    // Translated copy for everything an author can actually get wrong. The raw
    // schema issues are only a fallback, so a shape we failed to anticipate
    // still says something rather than saving silently.
    const messages = describeDraftProblems({ draft, t });

    if (!parsed.success || messages.length > 0) {
      setErrors(
        messages.length > 0
          ? messages
          : parsed.success
            ? []
            : parsed.error.issues.map((issue) => issue.message),
      );
      return;
    }

    setErrors([]);

    const onSuccess = () => {
      toast.success(form ? t('Form updated') : t('Form created'));
      onOpenChange(false);
    };
    const onError = (error: { message: string }) => {
      setErrors([error.message]);
    };

    if (form) {
      updateForm.mutate(
        { id: form.id, name: draft.name.trim(), schema: parsed.data },
        { onSuccess, onError },
      );
      return;
    }

    createForm.mutate(
      { profileId, name: draft.name.trim(), schema: parsed.data },
      { onSuccess, onError },
    );
  };

  if (initial.unsupportedKeys.length > 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('This form needs an engineer')}</DialogTitle>
          <DialogDescription>
            {t(
              'It uses field types this editor cannot show: {fields}. Saving here would drop them, so edit it directly instead.',
              { fields: initial.unsupportedKeys.join(', ') },
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{form ? t('Edit form') : t('New form')}</DialogTitle>
        <DialogDescription>
          {t('Participants fill this in during the phase you choose.')}
        </DialogDescription>
      </DialogHeader>

      {/* DialogContent is the scroll container and pins the header and footer;
          this body only needs its own padding. */}
      <div className="flex flex-col gap-6 px-6 py-4">
        <Field>
          <FieldLabel htmlFor={`${fieldId}-name`}>
            {t('Internal name')}
          </FieldLabel>
          <Input
            id={`${fieldId}-name`}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <FieldDescription>
            {t('Only admins see this. Participants see the heading below.')}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${fieldId}-phase`}>{t('Phase')}</FieldLabel>
          <Select
            value={draft.phaseId || null}
            onValueChange={(next) =>
              setDraft({ ...draft, phaseId: next == null ? '' : String(next) })
            }
          >
            <SelectTrigger id={`${fieldId}-phase`} className="w-full">
              <SelectValue placeholder={t('Select a phase')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {phases.map((phase) => (
                  <SelectItem
                    key={phase.phaseId}
                    value={phase.phaseId}
                    disabled={occupiedPhaseIds.includes(phase.phaseId)}
                  >
                    {phase.name ?? phase.phaseId}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {t(
              'A phase can hold one form. Phases that already have one are unavailable.',
            )}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${fieldId}-title`}>{t('Heading')}</FieldLabel>
          <Input
            id={`${fieldId}-title`}
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${fieldId}-description`}>
            {t('Intro text')}
          </FieldLabel>
          <Textarea
            id={`${fieldId}-description`}
            rows={2}
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />
        </Field>

        {draft.fields.map((field, index) => (
          <CustomFormFieldEditor
            key={field.localId}
            field={field}
            index={index}
            total={draft.fields.length}
            onChange={(next) =>
              setDraft({
                ...draft,
                fields: withFieldAt({ fields: draft.fields, index, next }),
              })
            }
            onMove={(offset) =>
              setDraft({
                ...draft,
                fields: moveField({ fields: draft.fields, index, offset }),
              })
            }
            onRemove={() =>
              setDraft({
                ...draft,
                fields: draft.fields.filter((_, at) => at !== index),
              })
            }
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            setDraft({
              ...draft,
              fields: [
                ...draft.fields,
                createEmptyField(`new-${draft.fields.length}-${Date.now()}`),
              ],
            })
          }
        >
          <LuPlus data-icon="inline-start" />
          {t('Add field')}
        </Button>

        {errors.length > 0 ? (
          <div aria-live="polite" className="flex flex-col gap-1">
            {errors.map((message) => (
              <p key={message} className="text-sm text-destructive">
                {message}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          disabled={isSaving}
          onClick={() => onOpenChange(false)}
        >
          {t('Cancel')}
        </Button>
        <Button loading={isSaving} onClick={handleSave}>
          {form ? t('Save changes') : t('Create form')}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * Everything wrong with a draft, in the author's language. Mirrors the checks
 * `customFormDefinitionInputSchema` enforces on the server, which has no
 * translations of its own to offer.
 */
const describeDraftProblems = ({
  draft,
  t,
}: {
  draft: BuilderForm;
  t: TranslateFn;
}): string[] => {
  const problems: string[] = [];

  if (!draft.name.trim()) {
    problems.push(t('Give the form an internal name.'));
  }

  if (!draft.phaseId) {
    problems.push(t('Choose the phase this form appears on.'));
  }

  if (!draft.title.trim()) {
    problems.push(t('Give the form a heading participants will see.'));
  }

  if (draft.fields.length === 0) {
    problems.push(t('Add at least one field.'));
  }

  draft.fields.forEach((field, index) => {
    const position = index + 1;

    if (!field.title.trim()) {
      problems.push(
        t('Field {number} needs a question.', { number: position }),
      );
    }

    if (CHOICE_FIELD_KINDS.includes(field.kind) && field.options.length === 0) {
      problems.push(
        t('Field {number} needs at least one option.', { number: position }),
      );
    }
  });

  return problems;
};

/**
 * Replaces one field, re-deriving its key from the label while the key is still
 * free to change. Once a field has been saved its key is frozen — submissions
 * are stored under it, and renaming it would orphan every answer already given.
 */
const withFieldAt = ({
  fields,
  index,
  next,
}: {
  fields: BuilderField[];
  index: number;
  next: BuilderField;
}): BuilderField[] => {
  const key = next.isKeyFrozen
    ? next.key
    : deriveFieldKey({
        title: next.title,
        takenKeys: fields
          .filter((_, at) => at !== index)
          .map((field) => field.key),
        fallbackIndex: index,
      });

  return fields.map((field, at) => (at === index ? { ...next, key } : field));
};

const moveField = ({
  fields,
  index,
  offset,
}: {
  fields: BuilderField[];
  index: number;
  offset: -1 | 1;
}): BuilderField[] => {
  const target = index + offset;
  if (target < 0 || target >= fields.length) {
    return fields;
  }

  const reordered = [...fields];
  const [moved] = reordered.splice(index, 1);
  if (moved) {
    reordered.splice(target, 0, moved);
  }

  return reordered;
};

const firstFreePhaseId = ({
  phases,
  occupiedPhaseIds,
}: {
  phases: AdminDecisionPhase[];
  occupiedPhaseIds: string[];
}): string | undefined =>
  phases.find((phase) => !occupiedPhaseIds.includes(phase.phaseId))?.phaseId;
