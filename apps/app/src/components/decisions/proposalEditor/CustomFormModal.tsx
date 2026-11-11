'use client';

import { linkifyText } from '@/utils/linkDetection';
import type {
  CustomFormDefinitionSchema,
  XFormatPropertySchema,
} from '@op/common/client';
import { isCustomFormDefinition, schemaValidator } from '@op/common/client';
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
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { TranslateLink } from '../TranslateLink';
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
  const requiredFields = new Set(
    (definition.required ?? []).filter((key) => renderable.has(key)),
  );
  const answerableDefinition = {
    ...definition,
    required: [...requiredFields],
  };

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
    const result = schemaValidator.validate(answerableDefinition, cleaned);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    await onSubmit(cleaned);
  };

  // Errors that don't key to a rendered field (root-level or nested AJV paths,
  // or a field we skipped) would otherwise be invisible.
  const formLevelErrors = Object.entries(errors)
    .filter(([key]) => !renderable.has(key))
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
              return (
                <CustomFormField
                  key={key}
                  name={key}
                  field={field}
                  value={values[key]}
                  error={errors[key]}
                  isRequired={requiredFields.has(key)}
                  translation={translation}
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
          description={description}
          error={error}
          isRequired={isRequired}
          options={choices}
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
        {descriptionNode}
        <RadioGroup
          value={selected}
          onValueChange={(next) =>
            onChange(next == null || next === '' ? undefined : String(next))
          }
          required={isRequired}
          aria-invalid={Boolean(error)}
          className="flex w-full flex-row justify-between gap-1"
        >
          {choices.map((option) => (
            <Field key={option.value} className="flex-1 items-center gap-1">
              <RadioGroupItem
                id={`${fieldId}-${option.value}`}
                value={option.value}
              />
              <FieldLabel
                htmlFor={`${fieldId}-${option.value}`}
                className="justify-center"
              >
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

/** Enum dropdown. `items` lets base-ui's `Select.Value` show a translated label. */
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
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  isRequired: boolean;
  options: { value: string; label: string }[];
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
        items={options}
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
          {/* The trigger clamps, so `<bdi>` alone would clip the wrong end. */}
          <SelectValue
            dir="auto"
            className="ltr:text-left rtl:text-right"
            placeholder={t('decisions.proposals.selectOptionPlaceholder')}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <bdi>{option.label}</bdi>
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

function readEnumOptions(candidate: unknown): string[] {
  return Array.isArray(candidate)
    ? candidate.filter((option): option is string => typeof option === 'string')
    : [];
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
