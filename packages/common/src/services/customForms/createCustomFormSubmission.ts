import { db } from '@op/db/client';
import { customFormSubmissions } from '@op/db/schema';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { schemaValidator } from '../decision/schemaValidator';
import type {
  CreateCustomFormSubmissionInput,
  CustomFormDefinitionSchema,
} from './schemas/customForm';

/**
 * Records a single submission against a custom form.
 *
 * The submission is attached to a target entity via `profileId` — the
 * caller decides what the submission belongs to. Authentication is
 * enforced at the API boundary; the row itself records only what it is
 * attached to, not who submitted it.
 *
 * The submitted data is validated against the form's JSON Schema with the
 * shared AJV validator (the same one proposal templates use), so the
 * stored `data` always conforms to the definition it was submitted under.
 */
export const createCustomFormSubmission = async ({
  data: input,
}: {
  data: CreateCustomFormSubmissionInput;
  authUserId: string;
}) => {
  const form = await db.query.customForms.findFirst({
    where: { id: input.customFormId },
  });

  if (!form) {
    throw new NotFoundError('Custom form', input.customFormId);
  }

  // Single cast point at the DB boundary — the jsonb column holds the same
  // JSON Schema dialect used by proposal templates.
  const definition = form.schema as CustomFormDefinitionSchema;

  const result = schemaValidator.validate(definition, input.data);
  if (!result.valid) {
    throw new ValidationError(
      `Form submission validation failed: ${Object.values(result.errors).join(', ')}`,
      result.errors,
    );
  }

  const [submission] = await db
    .insert(customFormSubmissions)
    .values({
      customFormId: form.id,
      profileId: input.profileId,
      data: input.data,
    })
    .returning();

  if (!submission) {
    throw new CommonError('Failed to record custom form submission');
  }

  return submission;
};

/**
 * Returns the first custom form attached to `profileId`, or `null` when
 * none is attached. The single-form-per-profile assumption is sufficient
 * for the current Columbus use case; if a profile ever needs multiple
 * forms, the caller should switch to a name- or id-based lookup.
 */
export const getCustomFormForProfile = async ({
  profileId,
}: {
  profileId: string;
}) => {
  const form = await db.query.customForms.findFirst({
    where: {
      profileId,
      deletedAt: { isNull: true },
    },
  });

  return form ?? null;
};
