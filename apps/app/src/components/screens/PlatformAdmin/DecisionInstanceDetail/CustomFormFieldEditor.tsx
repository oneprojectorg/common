'use client';

import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import { useId, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CountedInputField, CountedTextareaField } from './CountedField';
import type {
  BuilderField,
  DraftProblem,
  FormFieldKind,
} from './formDefinition';
import {
  CHOICE_FIELD_KINDS,
  FORM_CHARACTER_LIMITS,
  FORM_FIELD_KINDS,
} from './formDefinition';
import { ProblemMessages, getProblemsWithCode } from './formProblems';

interface CustomFormFieldEditorProps {
  field: BuilderField;
  index: number;
  total: number;
  /** This field's problems only — the dialog has already selected them. */
  problems: DraftProblem[];
  onChange: (field: BuilderField) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

export const CustomFormFieldEditor = ({
  field,
  index,
  total,
  problems,
  onChange,
  onMove,
  onRemove,
}: CustomFormFieldEditorProps) => {
  const t = useTranslations();
  const fieldId = useId();
  const hasOptions = CHOICE_FIELD_KINDS.includes(field.kind);

  const titleProblems = getProblemsWithCode(
    problems,
    'field-missing-question',
    'field-question-too-long',
  );
  const optionProblems = getProblemsWithCode(problems, 'field-missing-options');
  const descriptionProblems = getProblemsWithCode(
    problems,
    'field-description-too-long',
  );

  const kindLabels: Record<FormFieldKind, string> = {
    'short-text': t('Short text'),
    'long-text': t('Long text'),
    number: t('admin.fieldTypeNumber'),
    checkbox: t('admin.fieldTypeCheckbox'),
    dropdown: t('Dropdown'),
    radio: t('admin.fieldTypeRadio'),
    'multi-select': t('decisions.proposals.selectAllThatApplyHint'),
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border p-4',
        // The dialog scrolls, so the card has to be findable from a glance
        // down the list, not only from the message inside it.
        problems.length > 0 && 'border-destructive',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">
          {t('admin.formFieldTitle', { number: index + 1 })}
        </h4>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('admin.moveFieldUpAction')}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <LuArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('admin.moveFieldDownAction')}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <LuArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('admin.removeFieldAction')}
            onClick={onRemove}
          >
            <LuTrash2 />
          </Button>
        </div>
      </div>

      <CountedInputField
        id={`${fieldId}-title`}
        label={t('admin.fieldQuestionLabel')}
        description={
          field.key
            ? t('admin.fieldStorageKeyHint', { key: field.key })
            : undefined
        }
        value={field.title}
        max={FORM_CHARACTER_LIMITS.fieldTitle}
        problems={titleProblems}
        onChange={(title) => onChange({ ...field, title })}
      />

      <Field>
        <FieldLabel htmlFor={`${fieldId}-kind`}>
          {t('admin.fieldAnswerTypeLabel')}
        </FieldLabel>
        <Select
          value={field.kind}
          // value → label map, or base-ui's `SelectValue` shows the raw kind
          // key ("short-text") in the trigger instead of its label.
          items={kindLabels}
          onValueChange={(next) => {
            // base-ui types the value as a bare string; match, don't assert.
            const kind = FORM_FIELD_KINDS.find(
              (candidate) => candidate === next,
            );
            if (!kind) {
              return;
            }

            onChange({
              ...field,
              kind,
              // Kept on a text field, options would turn it back into a
              // dropdown on save.
              options: CHOICE_FIELD_KINDS.includes(kind) ? field.options : [],
            });
          }}
        >
          <SelectTrigger id={`${fieldId}-kind`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FORM_FIELD_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kindLabels[kind]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {hasOptions ? (
        <OptionsField
          fieldId={`${fieldId}-options`}
          options={field.options}
          problems={optionProblems}
          onChange={(options) => onChange({ ...field, options })}
        />
      ) : null}

      <CountedTextareaField
        id={`${fieldId}-description`}
        label={t('admin.fieldHelperTextLabel')}
        value={field.description}
        max={FORM_CHARACTER_LIMITS.fieldDescription}
        problems={descriptionProblems}
        onChange={(description) => onChange({ ...field, description })}
      />

      <Field className="items-center" orientation="horizontal">
        <Checkbox
          id={`${fieldId}-required`}
          checked={field.isRequired}
          onCheckedChange={(checked) =>
            onChange({ ...field, isRequired: checked === true })
          }
        />
        <FieldLabel htmlFor={`${fieldId}-required`}>
          {t('decisions.processBuilder.requiredLabel')}
        </FieldLabel>
      </Field>
    </div>
  );
};

/**
 * Holds raw text rather than `options.join('\n')`: a parsed round-trip drops
 * the newline as it is typed, so the author could never start a second line.
 */
const OptionsField = ({
  fieldId,
  options,
  problems,
  onChange,
}: {
  fieldId: string;
  options: string[];
  problems: DraftProblem[];
  onChange: (options: string[]) => void;
}) => {
  const t = useTranslations();
  const [text, setText] = useState(options.join('\n'));

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>
        {t('decisions.processBuilder.optionsLabel')}
      </FieldLabel>
      <Textarea
        id={fieldId}
        rows={4}
        value={text}
        aria-invalid={problems.length > 0}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseOptions(event.target.value));
        }}
      />
      <FieldDescription>{t('admin.fieldOptionsHint')}</FieldDescription>
      <ProblemMessages problems={problems} />
    </Field>
  );
};

const parseOptions = (value: string): string[] => {
  const seen = new Set<string>();

  for (const line of value.split('\n')) {
    const option = line.trim();
    if (option) {
      seen.add(option);
    }
  }

  return [...seen];
};
