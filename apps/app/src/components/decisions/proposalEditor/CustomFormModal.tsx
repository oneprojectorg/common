'use client';

import { linkifyText } from '@/utils/linkDetection';
import type { XFormatPropertySchema } from '@op/common/client';
import { isCustomFormDefinition, schemaValidator } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Textarea } from '@op/sense/Textarea';
import { useId, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { TranslateLink } from '../TranslateLink';
import { EnumSelectField } from './EnumSelectField';
import { GridField } from './GridField';
import {
  getFieldOrder,
  readEnumOptions,
  readGridColumns,
  readGridRows,
} from './customFormSchema';
import {
  type CustomFormTranslation,
  useTranslateCustomForm,
} from './useTranslateCustomForm';

export type CustomFormValues = Record<string, unknown>;

interface CustomFormModalProps {
  isOpen: boolean;
  customFormId: string;
  /**
   * Form definition in the same JSON Schema dialect as proposal templates:
   * standard keywords for the data shape, `x-format` per property and
   * `x-field-order` for presentation.
   */
  schema: Record<string, unknown>;
  isSubmitting?: boolean;
  onSubmit: (values: CustomFormValues) => void | Promise<void>;
  /** Dismissing the modal cancels the whole submission (the proposal stays
   *  a draft) — completing the form is required to finish submitting. */
  onOpenChange: (open: boolean) => void;
  /** Label for the submit button; defaults to a generic "Submit". */
  submitLabel?: string;
}

interface CustomFormFieldProps {
  name: string;
  field: XFormatPropertySchema;
  value: unknown;
  error?: string;
  isRequired: boolean;
  /** The form's translated text. Omit to show the authored text. */
  translation?: CustomFormTranslation;
  onChange: (value: unknown) => void;
}

export function CustomFormModal({
  isOpen,
  customFormId,
  schema,
  isSubmitting,
  onSubmit,
  onOpenChange,
  submitLabel,
}: CustomFormModalProps) {
  const t = useTranslations();

  const [values, setValues] = useState<CustomFormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const definition = isCustomFormDefinition(schema) ? schema : undefined;
  const translateLink = useTranslateCustomForm({
    customFormId,
    definition,
    isOpen,
  });
  const { translation } = translateLink;

  if (!definition) {
    logger.error('Unsupported form definition', {
      context: 'CustomFormModal',
      schema: JSON.stringify(schema),
    });
    return null;
  }

  // Decided once, here: a field the renderer would skip must also come out of
  // `required`, or AJV rejects every submission over a field that isn't on
  // screen to show the error or be answered.
  const renderableKeys = getFieldOrder(definition).filter((key) => {
    const field = definition.properties?.[key];
    return !!field && typeof field === 'object' && canRenderField(field);
  });
  const renderable = new Set(renderableKeys);
  const gridKeys = new Set(
    renderableKeys.filter(
      (key) => definition.properties?.[key]?.['x-format'] === 'grid',
    ),
  );
  const requiredFields = new Set(
    (definition.required ?? []).filter((key) => renderable.has(key)),
  );
  const answerableDefinition = {
    ...definition,
    required: [...requiredFields],
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(
          ([errorKey]) => getErrorFieldKey(errorKey) !== key,
        ),
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Guard against Enter-key re-fires while a submission is in flight —
    // only the button is disabled, not the form's onSubmit.
    if (isSubmitting) {
      return;
    }
    const cleaned = cleanValues(values);
    const result = schemaValidator.validate(answerableDefinition, cleaned);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    await onSubmit(cleaned);
  };

  // Errors that don't key to a rendered field or grid row (root-level or other
  // nested paths, or a field we skipped) would otherwise be invisible.
  const formLevelErrors = Object.entries(errors)
    .filter(
      ([key]) => !renderable.has(key) && !gridKeys.has(getErrorFieldKey(key)),
    )
    .map(([, message]) => message);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* DialogContent already caps its height and scrolls internally. */}
      <DialogContent className="gap-0 p-0 sm:max-w-120">
        <DialogHeader>
          <DialogTitle>
            <bdi>
              {translation?.title ??
                definition.title ??
                t('decisions.proposals.additionalDetailsHeading')}
            </bdi>
          </DialogTitle>
        </DialogHeader>
        {/* `noValidate`: validation is AJV's (`schemaValidator`), and its
            messages are
            translated. Without it the browser validates first and `handleSubmit`
            never runs — and for a checkbox or radio base-ui puts `required` on a
            visually hidden input, so the native bubble is anchored to something
            invisible and the dialog just refuses to submit. `required` stays for
            the `aria-required` base-ui derives from it. */}
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
            <TranslateLink translation={translateLink} />
            {definition.description ? (
              <p className="text-base text-muted-foreground [&_a]:underline [&_a]:underline-offset-4">
                <bdi>
                  {linkifyText(
                    translation?.description ?? definition.description,
                  )}
                </bdi>
              </p>
            ) : null}
            {renderableKeys.map((key) => {
              const field = definition.properties?.[key];
              if (!field || typeof field !== 'object') {
                return null;
              }
              const fieldProps = {
                name: key,
                field,
                value: values[key],
                isRequired: requiredFields.has(key),
                translation,
                onChange: (value: unknown) => handleFieldChange(key, value),
              };
              return field['x-format'] === 'grid' ? (
                <GridField key={key} {...fieldProps} errors={errors} />
              ) : (
                <CustomFormField
                  key={key}
                  {...fieldProps}
                  error={errors[key]}
                />
              );
            })}
            {formLevelErrors.length > 0 ? (
              <div className="flex flex-col gap-1">
                {formLevelErrors.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <DialogFooter className="shrink-0">
            <Button type="submit" className="w-full" loading={isSubmitting}>
              {submitLabel ?? t('decisions.proposals.submitAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomFormField({
  name,
  field,
  value,
  error,
  isRequired,
  translation,
  onChange,
}: CustomFormFieldProps) {
  const fieldId = useId();
  const { label, description, toChoices } = getFieldText({
    name,
    field,
    translation,
  });
  const descriptionNode = description ? (
    <FieldDescription>{description}</FieldDescription>
  ) : null;

  if (field.type === 'boolean') {
    return (
      <Field data-invalid={Boolean(error)}>
        <Field className="items-start" orientation="horizontal">
          <Checkbox
            id={fieldId}
            checked={value === true}
            // Unchecked is stored as absent (not `false`) so JSON Schema
            // `required` treats an unchecked required checkbox as missing.
            onCheckedChange={(checked) => onChange(checked ? true : undefined)}
            required={isRequired}
            aria-invalid={Boolean(error)}
            className="mt-1"
          />
          <FieldLabel htmlFor={fieldId}>
            {label}
            {isRequired ? <RequiredAsterisk /> : null}
          </FieldLabel>
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  // Multi-select ("choose all that apply"): array of enum strings rendered
  // as a checkbox group. An empty selection is stored as absent so JSON
  // Schema `required` treats it as missing.
  if (field.type === 'array') {
    const multiChoices = toChoices(
      readEnumOptions(readItemsSchema(field)?.enum),
    );
    const selected = Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return (
      <FieldSet>
        <FieldLegend variant="label">
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLegend>
        {descriptionNode}
        {multiChoices.map((option) => (
          <Field
            key={option.value}
            className="items-start"
            orientation="horizontal"
          >
            <Checkbox
              id={`${fieldId}-${option.value}`}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, option.value]
                  : selected.filter((entry) => entry !== option.value);
                onChange(next.length > 0 ? next : undefined);
              }}
              aria-invalid={Boolean(error)}
              className="mt-1"
            />
            <FieldLabel htmlFor={`${fieldId}-${option.value}`}>
              <bdi>{option.label}</bdi>
            </FieldLabel>
          </Field>
        ))}
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldSet>
    );
  }

  const enumOptions = readEnumOptions(field.enum);
  const choices = toChoices(enumOptions);

  if (field['x-format'] === 'radio' && enumOptions.length > 0) {
    return (
      <FieldSet>
        <FieldLegend variant="label">
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLegend>
        {descriptionNode}
        <RadioGroup
          value={typeof value === 'string' ? value : null}
          onValueChange={(next) =>
            onChange(next == null || next === '' ? undefined : String(next))
          }
          required={isRequired}
          aria-invalid={Boolean(error)}
          className="gap-4"
        >
          {choices.map((option) => (
            <Field
              key={option.value}
              className="items-start"
              orientation="horizontal"
            >
              <RadioGroupItem
                id={`${fieldId}-${option.value}`}
                value={option.value}
                aria-invalid={Boolean(error)}
                className="mt-1"
              />
              <FieldLabel htmlFor={`${fieldId}-${option.value}`}>
                <bdi>{option.label}</bdi>
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldSet>
    );
  }

  if (field['x-format'] === 'dropdown' || enumOptions.length > 0) {
    return (
      <EnumSelectField
        fieldId={fieldId}
        label={label}
        description={description}
        error={error}
        isRequired={isRequired}
        options={choices}
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    const stringValue =
      typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : typeof value === 'string'
          ? value
          : '';
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLabel>
        <Input
          id={fieldId}
          type="number"
          dir="ltr"
          required={isRequired}
          aria-invalid={Boolean(error)}
          value={stringValue}
          onChange={(event) => {
            const next = event.target.value;
            if (next === '') {
              onChange(undefined);
              return;
            }
            const parsed =
              field.type === 'integer' ? parseInt(next, 10) : parseFloat(next);
            onChange(Number.isFinite(parsed) ? parsed : undefined);
          }}
        />
        {error ? <FieldError>{error}</FieldError> : null}
        {descriptionNode}
      </Field>
    );
  }

  const stringValue = typeof value === 'string' ? value : '';

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {isRequired ? <RequiredAsterisk /> : null}
      </FieldLabel>
      {field['x-format'] === 'long-text' ? (
        <Textarea
          id={fieldId}
          rows={3}
          required={isRequired}
          aria-invalid={Boolean(error)}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={fieldId}
          required={isRequired}
          aria-invalid={Boolean(error)}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? <FieldError>{error}</FieldError> : null}
      {descriptionNode}
    </Field>
  );
}

const CHOICE_FORMATS = new Set<XFormatPropertySchema['x-format']>([
  'radio',
  'dropdown',
]);

/**
 * The field's label, description and option labels, translated when available.
 * Label and description are admin-authored, so they come isolated in `<bdi>`.
 */
function getFieldText({
  name,
  field,
  translation,
}: {
  name: string;
  field: XFormatPropertySchema;
  translation?: CustomFormTranslation;
}) {
  const description = linkifyText(
    translation?.fieldDescriptions[name] ?? field.description,
  );

  return {
    label: <bdi>{translation?.fieldTitles[name] ?? field.title ?? name}</bdi>,
    // `FieldDescription` styles only its direct `a` children, so the `<bdi>`
    // carries the same link styles.
    description: description ? (
      <bdi className="[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary">
        {description}
      </bdi>
    ) : undefined,
    toChoices: (options: string[]) =>
      options.map((option) => ({
        value: option,
        label: translation?.optionLabels[name]?.[option] ?? option,
      })),
  };
}

/** False for a control that would draw with nothing to choose from. */
function canRenderField(field: XFormatPropertySchema): boolean {
  if (field['x-format'] === 'grid') {
    return readGridRows(field).length > 0 && readGridColumns(field).length > 0;
  }

  if (field.type === 'array') {
    return readEnumOptions(readItemsSchema(field)?.enum).length > 0;
  }

  if (CHOICE_FORMATS.has(field['x-format'])) {
    return readEnumOptions(field.enum).length > 0;
  }

  return true;
}

function readItemsSchema(field: XFormatPropertySchema) {
  return typeof field.items === 'object' && !Array.isArray(field.items)
    ? field.items
    : undefined;
}

/** A grid row's error is keyed `<field>.<row>`; this returns `<field>`. */
function getErrorFieldKey(errorKey: string): string {
  return errorKey.split('.')[0] ?? errorKey;
}

/** Drop unanswered fields so optional empties don't fail type validation. */
function cleanValues(values: CustomFormValues): CustomFormValues {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
}
