'use client';

import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import type { Key } from 'react';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

/**
 * Minimal JSON Schema subset accepted by `CustomFormModal`. The form owner
 * stores one of these on a `custom_forms` row, the modal renders fields
 * from `properties`, and the submitted values are persisted via a
 * `custom_form_submissions` row.
 *
 * Supported keywords:
 *   - object with `properties` (required) and `required` (optional)
 *   - per-field `type`: 'string' | 'number' | 'integer' | 'boolean'
 *   - per-field `title`, `description`, `enum` (string-only),
 *     `format: 'textarea'` (multiline string)
 */
const customFormFieldSchemaZ = z.object({
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  title: z.string().optional(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  format: z.literal('textarea').optional(),
});

export const customFormSchemaZ = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), customFormFieldSchemaZ),
});

export type CustomFormSchema = z.infer<typeof customFormSchemaZ>;
export type CustomFormFieldSchema = z.infer<typeof customFormFieldSchemaZ>;

export type CustomFormValues = Record<string, unknown>;

interface CustomFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Raw JSON Schema record loaded from the API. Parsed against
   *  `customFormSchemaZ` inside the modal so the caller can pass the
   *  untyped record straight through. The modal renders nothing if
   *  parsing fails. */
  schema: Record<string, unknown>;
  isSubmitting?: boolean;
  onSubmit: (values: CustomFormValues) => void | Promise<void>;
}

export function CustomFormModal({
  isOpen,
  onOpenChange,
  schema,
  isSubmitting,
  onSubmit,
}: CustomFormModalProps) {
  const t = useTranslations();

  const parsedSchema = useMemo(() => {
    const result = customFormSchemaZ.safeParse(schema);
    return result.success ? result.data : null;
  }, [schema]);

  const requiredFields = useMemo(
    () => new Set(parsedSchema?.required ?? []),
    [parsedSchema?.required],
  );

  const [values, setValues] = useState<CustomFormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!parsedSchema) {
    return null;
  }

  const handleFieldChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(({ [key]: _ignored, ...rest }) => rest);
    }
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    for (const key of requiredFields) {
      const field = parsedSchema.properties[key];
      if (!field) {
        continue;
      }
      const value = values[key];
      if (field.type === 'boolean') {
        if (value !== true) {
          next[key] = t('This field is required');
        }
        continue;
      }
      if (value === undefined || value === null || value === '') {
        next[key] = t('This field is required');
      }
    }
    return next;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    await onSubmit(values);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false}>
      <ModalHeader>{parsedSchema.title ?? t('Additional details')}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {parsedSchema.description ? (
            <p className="text-sm text-neutral-charcoal">
              {parsedSchema.description}
            </p>
          ) : null}
          {Object.entries(parsedSchema.properties).map(([key, field]) => (
            <CustomFormField
              key={key}
              name={key}
              field={field}
              value={values[key]}
              error={errors[key]}
              isRequired={requiredFields.has(key)}
              onChange={(value) => handleFieldChange(key, value)}
            />
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          color="primary"
          onPress={handleSubmit}
          isDisabled={isSubmitting}
        >
          {isSubmitting ? <LoadingSpinner className="size-4" /> : null}
          {t('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface CustomFormFieldProps {
  name: string;
  field: CustomFormFieldSchema;
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
          onChange={onChange}
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

  if (field.type === 'string' && field.enum && field.enum.length > 0) {
    const options = field.enum;
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
        {options.map((option) => (
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

  const useTextArea = field.format === 'textarea';
  return (
    <TextField
      label={label}
      description={field.description}
      errorMessage={error}
      isRequired={isRequired}
      useTextArea={useTextArea}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
    />
  );
}
