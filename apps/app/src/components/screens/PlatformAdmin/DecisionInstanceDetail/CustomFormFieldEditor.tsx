'use client';

import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
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
import { useId, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { BuilderField, FormFieldKind } from './formDefinition';
import { CHOICE_FIELD_KINDS, FORM_FIELD_KINDS } from './formDefinition';

interface CustomFormFieldEditorProps {
  field: BuilderField;
  index: number;
  total: number;
  onChange: (field: BuilderField) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

export const CustomFormFieldEditor = ({
  field,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: CustomFormFieldEditorProps) => {
  const t = useTranslations();
  const fieldId = useId();
  const hasOptions = CHOICE_FIELD_KINDS.includes(field.kind);

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
    <div className="flex flex-col gap-4 rounded-lg border p-4">
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

      <Field>
        <FieldLabel htmlFor={`${fieldId}-title`}>
          {t('admin.fieldQuestionLabel')}
        </FieldLabel>
        <Input
          id={`${fieldId}-title`}
          value={field.title}
          onChange={(event) =>
            onChange({ ...field, title: event.target.value })
          }
        />
        {field.key ? (
          <FieldDescription>
            {t('admin.fieldStorageKeyHint', { key: field.key })}
          </FieldDescription>
        ) : null}
      </Field>

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
          onChange={(options) => onChange({ ...field, options })}
        />
      ) : null}

      <Field>
        <FieldLabel htmlFor={`${fieldId}-description`}>
          {t('admin.fieldHelperTextLabel')}
        </FieldLabel>
        <Input
          id={`${fieldId}-description`}
          value={field.description}
          onChange={(event) =>
            onChange({ ...field, description: event.target.value })
          }
        />
      </Field>

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
  onChange,
}: {
  fieldId: string;
  options: string[];
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
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseOptions(event.target.value));
        }}
      />
      <FieldDescription>{t('admin.fieldOptionsHint')}</FieldDescription>
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
