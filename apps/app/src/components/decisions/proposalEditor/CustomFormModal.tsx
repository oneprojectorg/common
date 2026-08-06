'use client';

import type {
  CustomFormDefinitionSchema,
  XFormatPropertySchema,
} from '@op/common/client';
import { schemaValidator } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Textarea } from '@op/sense/Textarea';
import { screens } from '@op/styles/constants';
import { useId, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export type CustomFormValues = Record<string, unknown>;

interface CustomFormModalProps {
  isOpen: boolean;
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
  onChange: (value: unknown) => void;
}

export function CustomFormModal({
  isOpen,
  schema,
  isSubmitting,
  onSubmit,
  onOpenChange,
  submitLabel,
}: CustomFormModalProps) {
  const t = useTranslations();

  const [values, setValues] = useState<CustomFormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isCustomFormDefinition(schema)) {
    logger.error('Unsupported form definition', {
      context: 'CustomFormModal',
      schema: JSON.stringify(schema),
    });
    return null;
  }

  const definition = schema;
  const requiredFields = new Set(definition.required ?? []);

  const handleFieldChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(({ [key]: _ignored, ...rest }) => rest);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Guard against Enter-key re-fires while a submission is in flight —
    // only the button is disabled, not the form's onSubmit.
    if (isSubmitting) {
      return;
    }
    const cleaned = cleanValues(values);
    const result = schemaValidator.validate(definition, cleaned);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    await onSubmit(cleaned);
  };

  // Validation errors that don't key to a rendered field (root-level or
  // nested paths from AJV) would otherwise be invisible.
  const fieldKeys = new Set(Object.keys(definition.properties ?? {}));
  const formLevelErrors = Object.entries(errors)
    .filter(([key]) => !fieldKeys.has(key))
    .map(([, message]) => message);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* DialogContent already caps its height and scrolls internally. */}
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-120">
        <DialogHeader>
          <DialogTitle>
            {definition.title ?? t('Additional details')}
          </DialogTitle>
        </DialogHeader>
        {/* `noValidate`, as @op/ui's `<Form validationBehavior="aria">` was:
            validation is AJV's (`schemaValidator`), and its messages are
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
            {definition.description ? (
              <p className="text-base text-muted-foreground">
                {definition.description}
              </p>
            ) : null}
            {getFieldOrder(definition).map((key) => {
              const field = definition.properties?.[key];
              if (!field || typeof field !== 'object') {
                return null;
              }
              return (
                <CustomFormField
                  key={key}
                  name={key}
                  field={field}
                  value={values[key]}
                  error={errors[key]}
                  isRequired={requiredFields.has(key)}
                  onChange={(value) => handleFieldChange(key, value)}
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
              {submitLabel ?? t('Submit')}
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
  onChange,
}: CustomFormFieldProps) {
  const fieldId = useId();
  const label = field.title ?? name;
  // Same breakpoint the NPS survey uses to swap its scale control between
  // a horizontal radio row (desktop) and a dropdown (mobile).
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

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
    const itemSchema =
      typeof field.items === 'object' && !Array.isArray(field.items)
        ? field.items
        : undefined;
    const multiOptions = Array.isArray(itemSchema?.enum)
      ? itemSchema.enum.filter((option): option is string => {
          return typeof option === 'string';
        })
      : [];
    const selected = Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return (
      <FieldSet>
        <FieldLegend variant="label">
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLegend>
        {field.description ? (
          <FieldDescription>{field.description}</FieldDescription>
        ) : null}
        {multiOptions.map((option) => (
          <Field key={option} className="items-start" orientation="horizontal">
            <Checkbox
              id={`${fieldId}-${option}`}
              checked={selected.includes(option)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, option]
                  : selected.filter((entry) => entry !== option);
                onChange(next.length > 0 ? next : undefined);
              }}
              aria-invalid={Boolean(error)}
              className="mt-1"
            />
            <FieldLabel htmlFor={`${fieldId}-${option}`}>{option}</FieldLabel>
          </Field>
        ))}
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldSet>
    );
  }

  const enumOptions = Array.isArray(field.enum)
    ? field.enum.filter((option): option is string => {
        return typeof option === 'string';
      })
    : [];

  // NPS-style numeric scale — matches the ProcessSurveyModal control:
  // horizontal radio row with the label under each number on desktop,
  // dropdown on mobile.
  if (field['x-format'] === 'radio' && enumOptions.length > 0) {
    const selected = typeof value === 'string' ? value : null;

    if (isMobile) {
      return (
        <EnumSelectField
          fieldId={fieldId}
          label={label}
          description={field.description}
          error={error}
          isRequired={isRequired}
          options={enumOptions}
          value={selected}
          onChange={onChange}
        />
      );
    }

    return (
      <FieldSet>
        <FieldLegend variant="label">
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLegend>
        {field.description ? (
          <FieldDescription>{field.description}</FieldDescription>
        ) : null}
        <RadioGroup
          value={selected}
          onValueChange={(next) =>
            onChange(next == null || next === '' ? undefined : String(next))
          }
          required={isRequired}
          aria-invalid={Boolean(error)}
          className="flex w-full flex-row justify-between gap-1"
        >
          {enumOptions.map((option) => (
            <Field key={option} className="flex-1 items-center gap-1">
              <RadioGroupItem id={`${fieldId}-${option}`} value={option} />
              <FieldLabel
                htmlFor={`${fieldId}-${option}`}
                className="justify-center"
              >
                {option}
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
        description={field.description}
        error={error}
        isRequired={isRequired}
        options={enumOptions}
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
        {field.description ? (
          <FieldDescription>{field.description}</FieldDescription>
        ) : null}
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
          className="[unicode-bidi:plaintext]"
        />
      ) : (
        <Input
          id={fieldId}
          required={isRequired}
          aria-invalid={Boolean(error)}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          className="[unicode-bidi:plaintext]"
        />
      )}
      {error ? <FieldError>{error}</FieldError> : null}
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
    </Field>
  );
}

/**
 * Enum dropdown. Option values ARE their labels here, so base-ui's
 * `Select.Value` renders correctly without an `items` label map.
 */
function EnumSelectField({
  fieldId,
  label,
  description,
  error,
  isRequired,
  options,
  value,
  onChange,
}: {
  fieldId: string;
  label: string;
  description?: string;
  error?: string;
  isRequired: boolean;
  options: string[];
  value: string | null;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations();

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {isRequired ? <RequiredAsterisk /> : null}
      </FieldLabel>
      <Select
        value={value}
        onValueChange={(next) =>
          onChange(next == null ? undefined : String(next))
        }
        required={isRequired}
      >
        <SelectTrigger
          id={fieldId}
          className="w-full"
          aria-invalid={Boolean(error)}
        >
          <SelectValue placeholder={t('Select an option')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error ? <FieldError>{error}</FieldError> : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

function isCustomFormDefinition(
  schema: Record<string, unknown>,
): schema is CustomFormDefinitionSchema {
  return (
    schema.type === 'object' &&
    typeof schema.properties === 'object' &&
    schema.properties !== null
  );
}

/** Field keys ordered by `x-field-order`, then any remaining properties. */
function getFieldOrder(definition: CustomFormDefinitionSchema): string[] {
  const properties = definition.properties ?? {};
  const ordered = definition['x-field-order'] ?? [];
  return [
    ...ordered.filter((key) => properties[key]),
    ...Object.keys(properties).filter((key) => !ordered.includes(key)),
  ];
}

/** Drop unanswered fields so optional empties don't fail type validation. */
function cleanValues(values: CustomFormValues): CustomFormValues {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
}
