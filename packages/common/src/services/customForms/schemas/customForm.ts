import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

import type { XFormatPropertySchema } from '../../decision/types';

/**
 * Custom form definitions use the same JSON Schema dialect as proposal
 * templates: standard JSON Schema keywords describe the data shape, and
 * the `x-format` vendor extension per property plus `x-field-order`
 * describe presentation. Data is validated with the shared
 * `schemaValidator` (AJV) on submit.
 */
export interface CustomFormDefinitionSchema extends JSONSchema7 {
  [key: string]: unknown;
  properties?: Record<string, XFormatPropertySchema>;
  'x-field-order'?: string[];
  /**
   * The decision phase this form applies to, identified by a
   * `PhaseDefinition.id`. When absent, the form applies to the process's
   * initial (submission) phase. Used to decide which phase surfaces the form.
   */
  'x-phase'?: string;
}

/**
 * Wire schema for a `custom_forms` row. The `schema` field intentionally
 * holds any JSON value — validation against that schema happens at submit
 * time, not on the form definition itself.
 */
export const customFormSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  name: z.string(),
  schema: z.record(z.string(), z.unknown()),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

export type CustomFormDTO = z.infer<typeof customFormSchema>;

/** The resolved phase travels with the row so the client can't re-derive it. */
export const customFormWithPhaseSchema = customFormSchema.extend({
  phaseId: z.string().nullable(),
});

export type CustomFormWithPhaseDTO = z.infer<typeof customFormWithPhaseSchema>;

export const customFormSubmissionSchema = z.object({
  id: z.string().uuid(),
  customFormId: z.string().uuid(),
  profileId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

export type CustomFormSubmissionDTO = z.infer<
  typeof customFormSubmissionSchema
>;

/** Serialized submission payload cap — far above any real form, low enough
 *  that hostile callers can't persist multi-MB jsonb rows. */
export const CUSTOM_FORM_SUBMISSION_MAX_BYTES = 64 * 1024;

/** Keys that would make stored data a prototype-pollution hazard for any
 *  future reader that merges or re-keys `submission.data`. */
const FORBIDDEN_DATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** UTF-8 bytes, not UTF-16 code units — CJK and emoji are 3-4 bytes each, so
 *  `String.length` would let a payload past the cap it is meant to enforce. */
const serializedByteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/** Input for `createCustomFormSubmission`. */
export const createCustomFormSubmissionInputSchema = z.object({
  customFormId: z.uuid(),
  // Target entity's profile (e.g. proposal.profileId). The entity kind is
  // read off this profile's own `type` column, not duplicated on the
  // submission row.
  profileId: z.uuid(),
  data: z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_DATA_KEYS.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Key "${key}" is not allowed`,
        });
      }
    }
    if (serializedByteLength(value) > CUSTOM_FORM_SUBMISSION_MAX_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: 'Submission is too large',
      });
    }
  }),
});

export type CreateCustomFormSubmissionInput = z.infer<
  typeof createCustomFormSubmissionInputSchema
>;

// What the form builder may write. Structural only — the shape the renderer
// walks, plus caps. What each field *is* stays the renderer's business.

export const CUSTOM_FORM_DEFINITION_MAX_BYTES = 64 * 1024;
export const CUSTOM_FORM_MAX_FIELDS = 50;

const CUSTOM_FORM_FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const customFormFieldKeySchema = z
  .string()
  .max(64)
  .regex(
    CUSTOM_FORM_FIELD_KEY_PATTERN,
    'Field keys must start with a letter and contain only letters, numbers, and underscores',
  )
  .refine((key) => !FORBIDDEN_DATA_KEYS.has(key), {
    message: 'Field key is not allowed',
  });

/**
 * Permissive on purpose: the renderer decides what it can draw, and skips what
 * it can't. Enumerating the field kinds here would mean editing this file every
 * time one is added to `CustomFormModal`.
 */
export const customFormFieldSchema = z.looseObject({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
});

export type CustomFormField = z.infer<typeof customFormFieldSchema>;

/**
 * `x-phase` is required here though the stored type allows it to be absent, so
 * an authored form's phase never depends on which phase happens to be first.
 */
export const customFormDefinitionInputSchema = z
  .object({
    type: z.literal('object'),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    'x-phase': z.string().min(1).max(256),
    required: z.array(customFormFieldKeySchema),
    properties: z.record(customFormFieldKeySchema, customFormFieldSchema),
    'x-field-order': z.array(customFormFieldKeySchema),
  })
  .superRefine((definition, ctx) => {
    const keys = Object.keys(definition.properties);

    if (keys.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'A form needs at least one field',
        path: ['properties'],
      });
      return;
    }

    if (keys.length > CUSTOM_FORM_MAX_FIELDS) {
      ctx.addIssue({
        code: 'custom',
        message: `A form cannot have more than ${CUSTOM_FORM_MAX_FIELDS} fields`,
        path: ['properties'],
      });
    }

    const known = new Set(keys);

    for (const key of definition.required) {
      if (!known.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Required field "${key}" is not one of this form's fields`,
          path: ['required'],
        });
      }
    }

    refineFieldOrder({ order: definition['x-field-order'], known }, ctx);

    if (serializedByteLength(definition) > CUSTOM_FORM_DEFINITION_MAX_BYTES) {
      ctx.addIssue({ code: 'custom', message: 'Form definition is too large' });
    }
  });

/**
 * The renderer walks `x-field-order`, so a field missing from it is one nobody
 * ever sees.
 */
const refineFieldOrder = (
  { order, known }: { order: string[]; known: Set<string> },
  ctx: z.RefinementCtx,
): void => {
  const ordered = new Set(order);

  if (ordered.size !== order.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Field order lists the same field twice',
      path: ['x-field-order'],
    });
  }

  for (const key of order) {
    if (!known.has(key)) {
      ctx.addIssue({
        code: 'custom',
        message: `Field order references "${key}", which is not one of this form's fields`,
        path: ['x-field-order'],
      });
    }
  }

  for (const key of known) {
    if (!ordered.has(key)) {
      ctx.addIssue({
        code: 'custom',
        message: `Field "${key}" is missing from the field order`,
        path: ['x-field-order'],
      });
    }
  }
};

export type CustomFormDefinitionInput = z.infer<
  typeof customFormDefinitionInputSchema
>;

const customFormNameSchema = z.string().trim().min(1).max(256);

/** `profileId` is the decision process's own profile. */
export const createCustomFormInputSchema = z.object({
  profileId: z.uuid(),
  name: customFormNameSchema,
  schema: customFormDefinitionInputSchema,
});

export type CreateCustomFormInput = z.infer<typeof createCustomFormInputSchema>;

export const updateCustomFormInputSchema = z.object({
  id: z.uuid(),
  name: customFormNameSchema,
  schema: customFormDefinitionInputSchema,
});

export type UpdateCustomFormInput = z.infer<typeof updateCustomFormInputSchema>;

export const listCustomFormsInputSchema = z.object({ profileId: z.uuid() });

export type ListCustomFormsInput = z.infer<typeof listCustomFormsInputSchema>;

export const deleteCustomFormInputSchema = z.object({ id: z.uuid() });

export type DeleteCustomFormInput = z.infer<typeof deleteCustomFormInputSchema>;

/** Input for `getCustomFormForProfile`. */
export const getCustomFormForProfileInputSchema = z.object({
  profileId: z.uuid(),
  // The phase to resolve a form for. When omitted, the first form attached to
  // the profile is returned (legacy, phase-agnostic behavior).
  phaseId: z.string().optional(),
  // The process's initial phase id. A form with no `x-phase` is treated as
  // belonging to this phase, so legacy forms keep gating submission.
  initialPhaseId: z.string().optional(),
});

export type GetCustomFormForProfileInput = z.infer<
  typeof getCustomFormForProfileInputSchema
>;
