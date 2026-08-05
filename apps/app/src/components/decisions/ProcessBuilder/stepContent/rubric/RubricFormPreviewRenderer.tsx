'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import {
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { OptionBox } from '../../../forms/OptionBox';
import type { FieldDescriptor } from '../../../forms/types';

/** Yes/no field: `type: "string"` with exactly `"yes"` and `"no"` oneOf entries. */
function isYesNoField(schema: XFormatPropertySchema): boolean {
  if (
    schema.type !== 'string' ||
    !Array.isArray(schema.oneOf) ||
    schema.oneOf.length !== 2
  ) {
    return false;
  }
  const values = schema.oneOf
    .filter(
      (e): e is { const: string } =>
        typeof e === 'object' && e !== null && 'const' in e,
    )
    .map((e) => e.const);
  return values.includes('yes') && values.includes('no');
}

/** Scored integer scale (e.g. 1-5 rating). */
function isScoredField(schema: XFormatPropertySchema): boolean {
  return schema.type === 'integer' && typeof schema.maximum === 'number';
}

/**
 * Static read-only preview of rubric fields — what a reviewer will see.
 *
 * Mirrors `ReviewRubricForm`'s composition (sense `Field` + label + description,
 * boxed radio options for multiple choice, a Select for scored scales) so the
 * builder shows the real form rather than an approximation. The wrapper is
 * `inert`, which blocks pointer and keyboard interaction without the dimming a
 * `disabled` control would apply — a preview should look like the live form, not
 * like a greyed-out one.
 */
export function RubricFormPreviewRenderer({
  fields,
}: {
  fields: FieldDescriptor[];
}) {
  return (
    <div inert className="flex flex-col gap-6">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-4">
          <RubricField field={field} />
          <RationalePlaceholder />
        </div>
      ))}
    </div>
  );
}

/** Static placeholder for a single rubric criterion. */
function RubricField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { format, schema } = field;

  // Inline radios for the overall recommendation, as the review form renders it.
  if (isOverallRecommendationField(field.key)) {
    const recOptions = parseSchemaOptions(schema);

    return (
      <Field>
        <FieldTitle>{schema.title}</FieldTitle>
        {schema.description && (
          <FieldDescription>{schema.description}</FieldDescription>
        )}
        <RadioGroup
          aria-label={schema.title}
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
        >
          {recOptions.map((option) => {
            const optionValue = String(option.value);
            const id = `${field.key}-${optionValue}`;

            return (
              <Field
                key={optionValue}
                orientation="horizontal"
                className="w-auto"
              >
                <RadioGroupItem id={id} value={optionValue} />
                <FieldLabel htmlFor={id} className="font-normal">
                  {option.title || optionValue}
                </FieldLabel>
              </Field>
            );
          })}
        </RadioGroup>
      </Field>
    );
  }

  switch (format) {
    case 'dropdown': {
      if (isYesNoField(schema)) {
        return (
          <Field orientation="horizontal">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <FieldTitle>
                {schema.title}
                <CriterionBadge>{t('No/Yes')}</CriterionBadge>
              </FieldTitle>
              {schema.description && (
                <FieldDescription>{schema.description}</FieldDescription>
              )}
            </div>
            <Switch size="sm" aria-label={schema.title} />
          </Field>
        );
      }

      // A scored scale keeps its Select — a long scale is what a popup is for.
      if (isScoredField(schema)) {
        return (
          <Field>
            <FieldTitle>
              {schema.title}
              <CriterionBadge>{`${schema.maximum} ${t('pts')}`}</CriterionBadge>
            </FieldTitle>
            {schema.description && (
              <FieldDescription>{schema.description}</FieldDescription>
            )}
            <Select>
              <SelectTrigger aria-label={schema.title} className="w-full">
                <SelectValue placeholder={t('Select an option')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup />
              </SelectContent>
            </Select>
          </Field>
        );
      }

      // Multiple choice: one value, shown as boxed radios like the review form.
      const options = parseSchemaOptions(schema);

      return (
        <Field>
          <FieldTitle>{schema.title}</FieldTitle>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
          <RadioGroup aria-label={schema.title} className="gap-2">
            {options.map((option) => {
              const optionValue = String(option.value);
              const id = `${field.key}-${optionValue}`;

              return (
                <OptionBox
                  key={optionValue}
                  htmlFor={id}
                  control={<RadioGroupItem id={id} value={optionValue} />}
                  label={option.title || optionValue}
                  description={option.description}
                />
              );
            })}
          </RadioGroup>
        </Field>
      );
    }

    case 'short-text':
    case 'long-text': {
      const controlId = `${field.key}-preview`;

      return (
        <Field>
          <FieldLabel htmlFor={controlId}>{schema.title}</FieldLabel>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
          {format === 'long-text' ? (
            <Textarea
              id={controlId}
              rows={3}
              placeholder={t('Start typing...')}
            />
          ) : (
            <Input id={controlId} placeholder={t('Start typing...')} />
          )}
        </Field>
      );
    }

    default:
      return null;
  }
}

/** The points / yes-no marker that rides inline with a criterion's title. */
function CriterionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-normal text-muted-foreground">
      {children}
    </span>
  );
}

/** Collapsed "Add note" affordance mirroring the review form's default state. */
function RationalePlaceholder() {
  const t = useTranslations();

  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto self-start px-2 py-1.5 leading-normal"
    >
      <LuPlus className="size-4" />
      {t('Add note')}
    </Button>
  );
}
