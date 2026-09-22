'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionPhase,
  CustomFormDefinitionInput,
  CustomFormWithPhaseDTO,
} from '@op/common/client';
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

import {
  type TranslateFn,
  type TranslationKey,
  useTranslations,
} from '@/lib/i18n';

import { CustomFormFieldEditor } from './CustomFormFieldEditor';
import type {
  BuilderField,
  BuilderForm,
  DraftProblem,
  DraftProblemCode,
} from './formDefinition';
import {
  createEmptyField,
  deriveFieldKey,
  initialDraftFor,
  validateDraft,
} from './formDefinition';

interface CustomFormBuilderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  phases: AdminDecisionPhase[];
  /** Excludes the phase of the form being edited. */
  occupiedPhaseIds: string[];
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
  const initial = initialDraftFor({ form, phases, occupiedPhaseIds });

  const [draft, setDraft] = useState<BuilderForm>(initial.form);
  const [errors, setErrors] = useState<string[]>([]);

  const { save, isSaving } = useSaveCustomForm({
    form,
    profileId,
    onSaved: () => onOpenChange(false),
    onFailed: setErrors,
  });

  const handleSave = () => {
    const result = validateDraft(draft);

    if (!result.ok) {
      setErrors(
        result.problems
          .map((problem) => describeProblem(problem, t))
          // A schema issue with no detail would render an empty line.
          .filter(Boolean),
      );
      return;
    }

    setErrors([]);
    save({ name: draft.name.trim(), definition: result.definition });
  };

  if (initial.unsupportedKeys.length > 0) {
    return (
      <UnsupportedFormNotice
        unsupportedKeys={initial.unsupportedKeys}
        onClose={() => onOpenChange(false)}
      />
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
        <FormDetailsFields
          draft={draft}
          phases={phases}
          occupiedPhaseIds={occupiedPhaseIds}
          onChange={setDraft}
        />
        <FormFieldList draft={draft} onChange={setDraft} />
        <ValidationErrors messages={errors} />
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

const useSaveCustomForm = ({
  form,
  profileId,
  onSaved,
  onFailed,
}: {
  form?: CustomFormWithPhaseDTO;
  profileId: string;
  onSaved: () => void;
  onFailed: (messages: string[]) => void;
}) => {
  const t = useTranslations();
  const createForm = trpc.customForm.create.useMutation();
  const updateForm = trpc.customForm.update.useMutation();

  const handlers = {
    onSuccess: () => {
      toast.success(form ? t('Form updated') : t('Form created'));
      onSaved();
    },
    onError: (error: { message: string }) => onFailed([error.message]),
  };

  const save = ({
    name,
    definition,
  }: {
    name: string;
    definition: CustomFormDefinitionInput;
  }) => {
    if (form) {
      updateForm.mutate({ id: form.id, name, schema: definition }, handlers);
      return;
    }

    createForm.mutate({ profileId, name, schema: definition }, handlers);
  };

  return { save, isSaving: createForm.isPending || updateForm.isPending };
};

const FormDetailsFields = ({
  draft,
  phases,
  occupiedPhaseIds,
  onChange,
}: {
  draft: BuilderForm;
  phases: AdminDecisionPhase[];
  occupiedPhaseIds: string[];
  onChange: (draft: BuilderForm) => void;
}) => {
  const t = useTranslations();
  const fieldId = useId();

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${fieldId}-name`}>
          {t('Internal name')}
        </FieldLabel>
        <Input
          id={`${fieldId}-name`}
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        <FieldDescription>
          {t('Only admins see this. Participants see the heading below.')}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${fieldId}-phase`}>{t('Phase')}</FieldLabel>
        <Select
          value={draft.phaseId || null}
          // value → label map, or base-ui's `SelectValue` shows the raw phase
          // id in the trigger instead of the phase's name.
          items={Object.fromEntries(
            phases.map((phase) => [phase.phaseId, phase.name ?? phase.phaseId]),
          )}
          onValueChange={(next) =>
            onChange({ ...draft, phaseId: next == null ? '' : String(next) })
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
            onChange({ ...draft, title: event.target.value })
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
            onChange({ ...draft, description: event.target.value })
          }
        />
      </Field>
    </>
  );
};

const FormFieldList = ({
  draft,
  onChange,
}: {
  draft: BuilderForm;
  onChange: (draft: BuilderForm) => void;
}) => {
  const t = useTranslations();

  return (
    <>
      {draft.fields.map((field, index) => (
        <CustomFormFieldEditor
          key={field.localId}
          field={field}
          index={index}
          total={draft.fields.length}
          onChange={(next) =>
            onChange({
              ...draft,
              fields: withFieldAt({ fields: draft.fields, index, next }),
            })
          }
          onMove={(offset) =>
            onChange({
              ...draft,
              fields: moveField({ fields: draft.fields, index, offset }),
            })
          }
          onRemove={() =>
            onChange({
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
          onChange({
            ...draft,
            fields: [...draft.fields, createEmptyField(nextLocalId(draft))],
          })
        }
      >
        <LuPlus data-icon="inline-start" />
        {t('decisions.processBuilder.addFieldAction')}
      </Button>
    </>
  );
};

const ValidationErrors = ({ messages }: { messages: string[] }) => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      {/* Keyed by position: two schema issues can carry the same text, and a
          repeated key would drop one of them silently. */}
      {messages.map((message, index) => (
        <p key={index} className="text-sm text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
};

const UnsupportedFormNotice = ({
  unsupportedKeys,
  onClose,
}: {
  unsupportedKeys: string[];
  onClose: () => void;
}) => {
  const t = useTranslations();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('This form needs an engineer')}</DialogTitle>
        <DialogDescription>
          {t(
            'It uses field types this editor cannot show: {fields}. Saving here would drop them, so edit it directly instead.',
            { fields: unsupportedKeys.join(', ') },
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('Close')}
        </Button>
      </DialogFooter>
    </>
  );
};

/** Keyed, not switched, so a new code is a compile error here. `schema` is
 *  absent on purpose — it carries its own raw detail. */
const PROBLEM_MESSAGES: Record<
  Exclude<DraftProblemCode, 'schema'>,
  TranslationKey
> = {
  'missing-name': 'Give the form an internal name.',
  'missing-phase': 'Choose the phase this form appears on.',
  'missing-title': 'Give the form a heading participants will see.',
  'no-fields': 'Add at least one field.',
  'field-missing-question': 'Field {number} needs a question.',
  'field-missing-options': 'Field {number} needs at least one option.',
};

const describeProblem = (problem: DraftProblem, t: TranslateFn): string =>
  problem.code === 'schema'
    ? (problem.detail ?? '')
    : t(PROBLEM_MESSAGES[problem.code], { number: problem.position });

/** Re-derives the key from the label while it is still free to change. */
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

/** Counts up rather than using the field count, which repeats an id after a
 *  removal and collapses two React rows into one. */
const nextLocalId = (draft: BuilderForm): string => {
  const used = new Set(draft.fields.map((field) => field.localId));

  let index = draft.fields.length;
  while (used.has(`new-${index}`)) {
    index += 1;
  }

  return `new-${index}`;
};
