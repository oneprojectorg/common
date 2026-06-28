import { db } from '@op/db/client';
import { customFormSubmissions } from '@op/db/schema';

import { CommonError, NotFoundError } from '../../utils';
import type { CreateCustomFormSubmissionInput } from './schemas/customForm';

/**
 * Records a single submission against a custom form.
 *
 * The submission is attached to a target entity via `profileId` and
 * `entityType` — the caller decides what kind of thing the submission
 * belongs to. Authentication is enforced at the API boundary; the row
 * itself records only what it is attached to, not who submitted it.
 *
 * Validation against the form's JSON Schema is the caller's
 * responsibility; the raw `data` is stored as-is.
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
