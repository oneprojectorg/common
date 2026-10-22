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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { toast } from '@op/sense/Toast';
import { useId, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CountedInputField, CountedTextareaField } from './CountedField';
import { CustomFormFieldEditor } from './CustomFormFieldEditor';
import type { BuilderField, BuilderForm, DraftProblem } from './formDefinition';
import {
  FORM_CHARACTER_LIMITS,
  createEmptyField,
  deriveFieldKey,
  initialDraftFor,
  validateDraft,
} from './formDefinition';
import { ProblemMessages, getProblemsWithCode } from './formProblems';

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
  const [problems, setProblems] = useState<DraftProblem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { save, isSaving } = useSaveCustomForm({
    form,
    profileId,
    onSaved: () => onOpenChange(false),
    onFailed: setSaveError,
  });

  const handleSave = () => {
    const result = validateDraft(draft);
    setSaveError(null);

    if (!result.ok) {
      setProblems(result.problems);
      return;
    }

    setProblems([]);
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
        <DialogTitle>
          {form ? t('admin.editFormTitle') : t('admin.newFormAction')}
        </DialogTitle>
        <DialogDescription>{t('admin.formDialogSubtitle')}</DialogDescription>
      </DialogHeader>

      {/* DialogContent is the scroll container and pins the header and footer;
          this body only needs its own padding. */}
      <div className="flex flex-col gap-6 px-6 py-4">
        <FormDetailsFields
          draft={draft}
          problems={problems}
          phases={phases}
          occupiedPhaseIds={occupiedPhaseIds}
          onChange={setDraft}
        />
        <FormFieldList draft={draft} problems={problems} onChange={setDraft} />
        <SaveErrors problems={problems} saveError={saveError} />
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
          {form ? t('Save changes') : t('admin.createFormAction')}
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
  onFailed: (message: string) => void;
}) => {
  const t = useTranslations();
  const createForm = trpc.customForm.create.useMutation();
  const updateForm = trpc.customForm.update.useMutation();

  const handlers = {
    onSuccess: () => {
      toast.success(
        form ? t('admin.formUpdatedToast') : t('admin.formCreatedToast'),
      );
      onSaved();
    },
    onError: (error: { message: string }) => onFailed(error.message),
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
  problems,
  phases,
  occupiedPhaseIds,
  onChange,
}: {
  draft: BuilderForm;
  problems: DraftProblem[];
  phases: AdminDecisionPhase[];
  occupiedPhaseIds: string[];
  onChange: (draft: BuilderForm) => void;
}) => {
  const t = useTranslations();
  const fieldId = useId();

  return (
    <>
      <CountedInputField
        id={`${fieldId}-name`}
        label={t('admin.formInternalNameLabel')}
        description={t('admin.formInternalNameHint')}
        value={draft.name}
        max={FORM_CHARACTER_LIMITS.name}
        problems={getProblemsWithCode(
          problems,
          'missing-name',
          'name-too-long',
        )}
        onChange={(name) => onChange({ ...draft, name })}
      />

      <PhaseField
        id={`${fieldId}-phase`}
        phaseId={draft.phaseId}
        phases={phases}
        occupiedPhaseIds={occupiedPhaseIds}
        problems={getProblemsWithCode(problems, 'missing-phase')}
        onChange={(phaseId) => onChange({ ...draft, phaseId })}
      />

      <CountedInputField
        id={`${fieldId}-title`}
        label={t('admin.formHeadingLabel')}
        value={draft.title}
        max={FORM_CHARACTER_LIMITS.title}
        problems={getProblemsWithCode(
          problems,
          'missing-title',
          'title-too-long',
        )}
        onChange={(title) => onChange({ ...draft, title })}
      />

      <CountedTextareaField
        id={`${fieldId}-description`}
        label={t('admin.formIntroLabel')}
        value={draft.description}
        max={FORM_CHARACTER_LIMITS.description}
        problems={getProblemsWithCode(problems, 'description-too-long')}
        onChange={(description) => onChange({ ...draft, description })}
      />
    </>
  );
};

const PhaseField = ({
  id,
  phaseId,
  phases,
  occupiedPhaseIds,
  problems,
  onChange,
}: {
  id: string;
  phaseId: string;
  phases: AdminDecisionPhase[];
  occupiedPhaseIds: string[];
  problems: DraftProblem[];
  onChange: (phaseId: string) => void;
}) => {
  const t = useTranslations();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t('admin.formPhaseLabel')}</FieldLabel>
      <Select
        value={phaseId || null}
        // value → label map, or base-ui's `SelectValue` shows the raw phase
        // id in the trigger instead of the phase's name.
        items={Object.fromEntries(
          phases.map((phase) => [phase.phaseId, phase.name ?? phase.phaseId]),
        )}
        onValueChange={(next) => onChange(next == null ? '' : String(next))}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={problems.length > 0}
        >
          <SelectValue placeholder={t('admin.formPhasePlaceholder')} />
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
      <FieldDescription>{t('admin.formPhaseHint')}</FieldDescription>
      <ProblemMessages problems={problems} />
    </Field>
  );
};

const FormFieldList = ({
  draft,
  problems,
  onChange,
}: {
  draft: BuilderForm;
  problems: DraftProblem[];
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
          problems={problems.filter(
            (problem) => problem.fieldLocalId === field.localId,
          )}
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

      <ProblemMessages
        problems={getProblemsWithCode(problems, 'no-fields', 'too-many-fields')}
      />
    </>
  );
};

/**
 * The problems no control owns: the `schema` backstop, and whatever the server
 * rejected the save with.
 */
const SaveErrors = ({
  problems,
  saveError,
}: {
  problems: DraftProblem[];
  saveError: string | null;
}) => {
  const messages = [
    ...getProblemsWithCode(problems, 'schema').map((problem) => problem.detail),
    saveError,
  ].filter((message): message is string => Boolean(message));

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
        <DialogTitle>{t('admin.formUnsupportedTitle')}</DialogTitle>
        <DialogDescription>
          {t('admin.formUnsupportedHint', {
            fields: unsupportedKeys.join(', '),
          })}
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
