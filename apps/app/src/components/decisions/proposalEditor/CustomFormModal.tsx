'use client';

import type {
  CustomFormDefinitionSchema,
  XFormatPropertySchema,
} from '@op/common/client';
import { schemaValidator } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Checkbox, CheckboxGroup } from '@op/ui/Checkbox';
import { Form } from '@op/ui/Form';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import type { Key } from 'react';
import { useState } from 'react';

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
  /** Skip without filling in the form (the proposal still submits). */
  onSkip: () => void;
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

export function CustomFormModal({
  isOpen,
  schema,
  isSubmitting,
  onSubmit,
  onSkip,
}: CustomFormModalProps) {
  const t = useTranslations();

  const [values, setValues] = useState<CustomFormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isCustomFormDefinition(schema)) {
    console.error('[CustomFormModal] Unsupported form definition', schema);
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
    const cleaned = cleanValues(values);
    const result = schemaValidator.validate(definition, cleaned);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    await onSubmit(cleaned);
  };

  return (
    <Modal isOpen={isOpen} className="flex flex-col">
      <ModalHeader>{definition.title ?? t('Additional details')}</ModalHeader>
      <Form
        onSubmit={handleSubmit}
        validationBehavior="aria"
        className="flex flex-1 flex-col gap-0"
      >
        <ModalBody className="flex-1 gap-6">
          {definition.description ? (
            <p className="text-base text-neutral-charcoal">
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
        </ModalBody>
        <ModalFooter className="sticky">
          <Button
            type="button"
            variant="link"
            onPress={onSkip}
            isDisabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {t('Maybe later')}
          </Button>
          <Button
            type="submit"
            color="primary"
            className="w-full sm:w-auto"
            isDisabled={isSubmitting}
          >
            {isSubmitting ? <LoadingSpinner className="size-4" /> : null}
            {t('Submit')}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
}

interface CustomFormFieldProps {
  name: string;
  field: XFormatPropertySchema;
  value: unknown;
  error?: string;
  isRequired: boolean;
  onChange: (value: unknown) => void;
}

function CustomFormField({
  name,
  field,
  value,
  error,
  isRequired,
  onChange,
}: CustomFormFieldProps) {
  const label = field.title ?? name;

  if (field.type === 'boolean') {
    return (
      <div className="flex flex-col gap-1">
        <Checkbox
          isSelected={value === true}
          // Unchecked is stored as absent (not `false`) so JSON Schema
          // `required` treats an unchecked required checkbox as missing.
          onChange={(checked) => onChange(checked ? true : undefined)}
          isRequired={isRequired}
        >
          {label}
        </Checkbox>
        {error ? (
          <span className="text-sm text-functional-red">{error}</span>
        ) : null}
      </div>
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
      <CheckboxGroup
        label={label}
        description={field.description}
        errorMessage={error}
        isInvalid={Boolean(error)}
        isRequired={isRequired}
        value={selected}
        onChange={(next) => onChange(next.length > 0 ? next : undefined)}
      >
        {multiOptions.map((option) => (
          <Checkbox key={option} value={option} size="small">
            {option}
          </Checkbox>
        ))}
      </CheckboxGroup>
    );
  }

  const enumOptions = Array.isArray(field.enum)
    ? field.enum.filter((option): option is string => {
        return typeof option === 'string';
      })
    : [];

  if (field['x-format'] === 'dropdown' || enumOptions.length > 0) {
    const selected = typeof value === 'string' ? value : undefined;
    const onSelectionChange = (key: Key | null) => {
      onChange(key == null ? undefined : String(key));
    };
    return (
      <Select
        label={label}
        description={field.description}
        errorMessage={error}
        isRequired={isRequired}
        selectedKey={selected ?? null}
        onSelectionChange={onSelectionChange}
      >
        {enumOptions.map((option) => (
          <SelectItem key={option} id={option} textValue={option}>
            {option}
          </SelectItem>
        ))}
      </Select>
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
      <TextField
        label={label}
        description={field.description}
        errorMessage={error}
        isRequired={isRequired}
        type="number"
        value={stringValue}
        onChange={(next) => {
          if (next === '') {
            onChange(undefined);
            return;
          }
          const parsed =
            field.type === 'integer' ? parseInt(next, 10) : parseFloat(next);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    );
  }

  const useTextArea = field['x-format'] === 'long-text';
  return (
    <TextField
      label={label}
      description={field.description}
      errorMessage={error}
      isRequired={isRequired}
      useTextArea={useTextArea}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      textareaProps={useTextArea ? { rows: 3 } : undefined}
    />
  );
}
