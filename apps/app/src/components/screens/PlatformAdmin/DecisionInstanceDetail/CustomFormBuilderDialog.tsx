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
      setErrors(result.problems.map((problem) => describeProblem(problem, t)));
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

/**
 * Saves the draft through whichever mutation fits — update when the dialog
 * opened on an existing form, create otherwise — so the component above only
 * has to know that saving happened.
 */
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

/** Form-level settings: the admin label, the phase, and the participant copy. */
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

/** The ordered field list plus its add control. */
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
        {t('Add field')}
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
      {messages.map((message) => (
        <p key={message} className="text-sm text-destructive">
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

/**
 * Copy for each problem code. Keyed rather than switched so adding a code is a
 * compile error here rather than a silently unrendered message. `schema` is
 * absent on purpose: it carries its own raw detail, because it only fires for a
 * shape we have no specific copy for.
 */
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

/**
 * A local id no current field holds. Counting upward from the highest `new-N`
 * already in the draft keeps it unique after a removal, where the field count
 * alone would repeat an id and collapse two React rows into one.
 */
const nextLocalId = (draft: BuilderForm): string => {
  const used = new Set(draft.fields.map((field) => field.localId));

  let index = draft.fields.length;
  while (used.has(`new-${index}`)) {
    index += 1;
  }

  return `new-${index}`;
};
