import { z } from 'zod';

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

/** Input for `createCustomFormSubmission`. */
export const createCustomFormSubmissionInputSchema = z.object({
  customFormId: z.uuid(),
  // Target entity's profile (e.g. proposal.profileId). The entity kind is
  // read off this profile's own `type` column, not duplicated on the
  // submission row.
  profileId: z.uuid(),
  data: z.record(z.string(), z.unknown()),
});

export type CreateCustomFormSubmissionInput = z.infer<
  typeof createCustomFormSubmissionInputSchema
>;
