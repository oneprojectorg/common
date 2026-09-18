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

/** Wire schema for the admin list: each row carries the phase it resolves to,
 *  so the editor doesn't re-derive `x-phase`-or-initial-phase on the client. */
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
    if (JSON.stringify(value).length > CUSTOM_FORM_SUBMISSION_MAX_BYTES) {
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

// ── Form definition authoring ──────────────────────────────────────────
//
// The schemas below describe what the platform-admin form builder may write.
// They are deliberately narrower than `CustomFormDefinitionSchema` (which types
// anything already stored): a definition only goes in if `CustomFormModal` can
// render it, so the builder cannot persist a field participants would see as a
// blank or unanswerable control.

/** Serialized definition cap, matching {@link CUSTOM_FORM_SUBMISSION_MAX_BYTES}. */
export const CUSTOM_FORM_DEFINITION_MAX_BYTES = 64 * 1024;

/** Upper bounds on a single form. Far above any survey we run; low enough that
 *  one form can't become an unreviewable wall of controls. */
export const CUSTOM_FORM_MAX_FIELDS = 50;
export const CUSTOM_FORM_MAX_OPTIONS = 100;

/** JSON Schema property names the builder may use. Excludes `__proto__` by
 *  shape and `constructor` / `prototype` by {@link FORBIDDEN_DATA_KEYS}. */
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

const optionListSchema = z
  .array(z.string().min(1).max(500))
  .min(1)
  .max(CUSTOM_FORM_MAX_OPTIONS);

/**
 * One authored field. `type` plus `enum` / `items` describe the data, and
 * `x-format` picks between the controls `CustomFormModal` renders for that
 * shape (long-text vs single-line for a string; radio row vs dropdown for a
 * single-choice enum).
 */
export const customFormFieldSchema = z
  .object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array']),
    title: z.string().min(1).max(500),
    description: z.string().max(1000).optional(),
    'x-format': z
      .enum(['short-text', 'long-text', 'dropdown', 'radio'])
      .optional(),
    /** Single-choice options; only valid on a `string` field. */
    enum: optionListSchema.optional(),
    /** Multi-choice options; only valid on an `array` field. */
    items: z
      .object({ type: z.literal('string'), enum: optionListSchema })
      .optional(),
    uniqueItems: z.boolean().optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'array') {
      if (!field.items) {
        ctx.addIssue({
          code: 'custom',
          message: 'A multi-select field needs at least one option',
          path: ['items'],
        });
      }
      if (field.enum) {
        ctx.addIssue({
          code: 'custom',
          message: 'A multi-select field lists its options under `items`',
          path: ['enum'],
        });
      }
      return;
    }

    if (field.items) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only a multi-select field may declare `items`',
        path: ['items'],
      });
    }

    if (field.enum && field.type !== 'string') {
      ctx.addIssue({
        code: 'custom',
        message: 'Only a text field may offer a fixed list of options',
        path: ['enum'],
      });
    }

    // `radio` and `dropdown` are choice controls: without options the renderer
    // has nothing to draw.
    const format = field['x-format'];
    if ((format === 'radio' || format === 'dropdown') && !field.enum) {
      ctx.addIssue({
        code: 'custom',
        message: 'A choice field needs at least one option',
        path: ['enum'],
      });
    }

    if (format === 'long-text' && field.enum) {
      ctx.addIssue({
        code: 'custom',
        message: 'A long-text field cannot offer a fixed list of options',
        path: ['x-format'],
      });
    }
  });

export type CustomFormField = z.infer<typeof customFormFieldSchema>;

/**
 * A full authored definition. `x-phase` is required here even though the stored
 * type allows it to be absent: every form the builder writes states its phase
 * outright, so the phase a participant sees it on never depends on which phase
 * happens to be first.
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

    // `x-field-order` is what the renderer walks, so a key missing from it is a
    // field nobody ever sees, and a key that isn't a field renders nothing.
    const ordered = new Set(definition['x-field-order']);
    if (ordered.size !== definition['x-field-order'].length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Field order lists the same field twice',
        path: ['x-field-order'],
      });
    }
    for (const key of definition['x-field-order']) {
      if (!known.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Field order references "${key}", which is not one of this form's fields`,
          path: ['x-field-order'],
        });
      }
    }
    for (const key of keys) {
      if (!ordered.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Field "${key}" is missing from the field order`,
          path: ['x-field-order'],
        });
      }
    }

    if (JSON.stringify(definition).length > CUSTOM_FORM_DEFINITION_MAX_BYTES) {
      ctx.addIssue({ code: 'custom', message: 'Form definition is too large' });
    }
  });

export type CustomFormDefinitionInput = z.infer<
  typeof customFormDefinitionInputSchema
>;

const customFormNameSchema = z.string().trim().min(1).max(256);

/** Input for `createCustomForm`. `profileId` is the decision process's profile. */
export const createCustomFormInputSchema = z.object({
  profileId: z.uuid(),
  name: customFormNameSchema,
  schema: customFormDefinitionInputSchema,
});

export type CreateCustomFormInput = z.infer<typeof createCustomFormInputSchema>;

/** Input for `updateCustomForm`. */
export const updateCustomFormInputSchema = z.object({
  id: z.uuid(),
  name: customFormNameSchema,
  schema: customFormDefinitionInputSchema,
});

export type UpdateCustomFormInput = z.infer<typeof updateCustomFormInputSchema>;

/** Input for `listCustomForms`. */
export const listCustomFormsInputSchema = z.object({ profileId: z.uuid() });

export type ListCustomFormsInput = z.infer<typeof listCustomFormsInputSchema>;

/** Input for `deleteCustomForm`. */
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
