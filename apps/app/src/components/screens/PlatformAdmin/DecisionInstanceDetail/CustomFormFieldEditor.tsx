'use client';

import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { Field, FieldLabel } from '@op/sense/Field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { cn } from '@op/sense/lib/utils';
import { useId, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GridField } from '@/components/decisions/proposalEditor/GridField';

import { CountedInputField, CountedTextareaField } from './CountedField';
import type {
  SortableInputItem,
  SortableInputListProps,
} from './SortableInputList';
import { SortableInputList } from './SortableInputList';
import type {
  BuilderField,
  DraftProblem,
  FormFieldKind,
} from './formDefinition';
import {
  CHOICE_FIELD_KINDS,
  FORM_CHARACTER_LIMITS,
  FORM_FIELD_KINDS,
  buildGridSchema,
} from './formDefinition';
import { getProblemsWithCode } from './formProblems';

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
  const rowProblems = getProblemsWithCode(
    problems,
    'field-missing-rows',
    'grid-row-too-long',
  );
  const isGrid = field.kind === 'grid';
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
    grid: t('admin.fieldTypeGrid'),
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
              rows: kind === 'grid' ? field.rows : [],
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
        <OptionsList
          label={
            isGrid
              ? t('admin.fieldColumnsLabel')
              : t('decisions.processBuilder.optionsLabel')
          }
          addLabel={
            isGrid ? t('admin.addColumnAction') : t('admin.addOptionAction')
          }
          getItemName={(at) =>
            isGrid
              ? t('admin.columnNumber', { number: at + 1 })
              : t('admin.optionNumber', { number: at + 1 })
          }
          initialOptions={field.options}
          problems={optionProblems}
          onChange={(options) => onChange({ ...field, options })}
        />
      ) : null}

      {isGrid ? (
        <>
          <SortableInputList
            label={t('admin.fieldRowsLabel')}
            addLabel={t('admin.addRowAction')}
            getItemName={(at) => t('admin.rowNumber', { number: at + 1 })}
            items={field.rows.map((row) => ({
              id: row.localId,
              value: row.title,
            }))}
            problems={rowProblems}
            maxLength={FORM_CHARACTER_LIMITS.gridRowTitle}
            onChange={(items) =>
              onChange({ ...field, rows: toGridRows({ items, field }) })
            }
          />
          <GridPreview field={field} />
        </>
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
 * Gives each option a stable id for reordering. The editor owns them because
 * options are stored as bare strings.
 */
const OptionsList = ({
  initialOptions,
  onChange,
  ...listProps
}: Omit<SortableInputListProps, 'items' | 'onChange'> & {
  initialOptions: string[];
  onChange: (options: string[]) => void;
}) => {
  const [items, setItems] = useState(() =>
    initialOptions.map((value) => ({ id: crypto.randomUUID(), value })),
  );

  return (
    <SortableInputList
      {...listProps}
      items={items}
      onChange={(next) => {
        setItems(next);
        onChange(toOptions(next));
      }}
    />
  );
};

/** What participants see, from the draft as it stands. */
const GridPreview = ({ field }: { field: BuilderField }) => {
  const t = useTranslations();
  const headingId = useId();
  const schema = buildGridSchema(field);

  if (field.options.length === 0 || schema['x-field-order']?.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-md bg-muted p-4"
    >
      <p id={headingId} className="text-label text-muted-foreground">
        {t('admin.gridPreviewLabel')}
      </p>
      {/* Inert: a preview to look at, not a form to fill in or tab through. */}
      <div inert>
        <GridField
          name={field.key || field.localId}
          field={schema}
          value={undefined}
          errors={{}}
          isRequired={field.isRequired}
          onChange={() => {}}
        />
      </div>
    </section>
  );
};

/** Keeps each stored row's key, so renaming a row keeps its answers. */
const toGridRows = ({
  items,
  field,
}: {
  items: SortableInputItem[];
  field: BuilderField;
}): BuilderField['rows'] =>
  items.map(({ id, value }) => {
    const key = field.rows.find((row) => row.localId === id)?.key;
    return { localId: id, title: value, ...(key ? { key } : {}) };
  });

/** Trimmed, without blanks or repeats: a repeated `enum` value is invalid. */
const toOptions = (items: SortableInputItem[]): string[] => [
  ...new Set(items.map((item) => item.value.trim()).filter(Boolean)),
];
