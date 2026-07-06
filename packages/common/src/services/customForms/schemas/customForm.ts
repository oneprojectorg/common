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
