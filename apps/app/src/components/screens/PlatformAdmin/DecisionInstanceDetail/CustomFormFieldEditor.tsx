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

/** One field's row in the builder: label, control type, options, required. */
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
    number: t('Number'),
    checkbox: t('Checkbox'),
    dropdown: t('Dropdown'),
    radio: t('Radio buttons'),
    'multi-select': t('Select all that apply'),
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">
          {t('Field {number}', { number: index + 1 })}
        </h4>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Move field up')}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <LuArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Move field down')}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <LuArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Remove field')}
            onClick={onRemove}
          >
            <LuTrash2 />
          </Button>
        </div>
      </div>

      <Field>
        <FieldLabel htmlFor={`${fieldId}-title`}>{t('Question')}</FieldLabel>
        <Input
          id={`${fieldId}-title`}
          value={field.title}
          onChange={(event) =>
            onChange({ ...field, title: event.target.value })
          }
        />
        {field.key ? (
          <FieldDescription>
            {t('Answers are stored under {key}', { key: field.key })}
          </FieldDescription>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor={`${fieldId}-kind`}>{t('Answer type')}</FieldLabel>
        <Select
          value={field.kind}
          // value → label map, or base-ui's `SelectValue` shows the raw kind
          // key ("short-text") in the trigger instead of its label.
          items={kindLabels}
          onValueChange={(next) => {
            // Matched against the list rather than asserted: base-ui types the
            // value as a bare string, and only these seven are field kinds.
            const kind = FORM_FIELD_KINDS.find(
              (candidate) => candidate === next,
            );
            if (!kind) {
              return;
            }

            onChange({
              ...field,
              kind,
              // Options belong to choice fields only; keeping them on a text
              // field would silently turn it back into a dropdown on save.
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
          {t('Helper text')}
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
        <FieldLabel htmlFor={`${fieldId}-required`}>{t('Required')}</FieldLabel>
      </Field>
    </div>
  );
};

/**
 * Options as free text, one per line.
 *
 * The textarea holds the raw text rather than `options.join('\n')`: a parsed
 * round-trip drops the newline the moment it is typed, so the author could
 * never start a second line. Mounted only while the field is a choice field, so
 * switching a field away from one and back starts from the cleared options.
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
      <FieldLabel htmlFor={fieldId}>{t('Options')}</FieldLabel>
      <Textarea
        id={fieldId}
        rows={4}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseOptions(event.target.value));
        }}
      />
      <FieldDescription>{t('One option per line.')}</FieldDescription>
    </Field>
  );
};

/** Textarea lines to options, dropping blanks and repeats. */
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
