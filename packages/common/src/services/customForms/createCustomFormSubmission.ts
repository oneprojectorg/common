import { db, eq } from '@op/db/client';
import type { CustomFormSubmission } from '@op/db/schema';
import { customFormSubmissions } from '@op/db/schema';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { schemaValidator } from '../decision/schemaValidator';
import type {
  CreateCustomFormSubmissionInput,
  CustomFormDefinitionSchema,
} from './schemas/customForm';

/**
 * Records a submission against a custom form, attached to the target
 * entity's profile (`profileId`).
 *
 * Authorization: the caller must hold profile access on the TARGET profile
 * (for a proposal attachment, the proposal's own profile — its creator and
 * collaborators). The target must also belong to the form's owning profile:
 * today the only attachment site is a proposal, so the proposal behind
 * `profileId` must live in the decision process that owns the form.
 *
 * Idempotent per (customFormId, profileId): a retry after a failed
 * follow-up mutation updates the existing row instead of inserting a
 * duplicate.
 *
 * The submitted data is validated against the form's JSON Schema with the
 * shared AJV validator (the same one proposal templates use), so the
 * stored `data` always conforms to the definition it was submitted under.
 */
export const createCustomFormSubmission = async ({
  data: input,
  authUserId,
}: {
  data: CreateCustomFormSubmissionInput;
  authUserId: string;
}): Promise<CustomFormSubmission> => {
  await assertProfileAccess({
    user: { id: authUserId },
    profileId: input.profileId,
    permissions: [
      { profile: permission.ADMIN },
      { profile: permission.UPDATE },
    ],
    notMemberMessage: 'You do not have access to this profile',
  });

  const form = await db.query.customForms.findFirst({
    where: {
      id: input.customFormId,
      deletedAt: { isNull: true },
    },
  });

  if (!form) {
    throw new NotFoundError('Custom form', input.customFormId);
  }

  // The only attachment site today is a proposal: the target profile must
  // belong to a proposal whose decision process owns this form. This stops
  // a caller from attaching their own entity to an unrelated form.
  const proposal = await db.query.proposals.findFirst({
    where: { profileId: input.profileId },
    with: { processInstance: true },
  });

  if (!proposal || proposal.processInstance.profileId !== form.profileId) {
    throw new ValidationError(
      'The submission target does not belong to this form',
    );
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

  const submission = await db.transaction(async (tx) => {
    const existing = await tx.query.customFormSubmissions.findFirst({
      where: {
        customFormId: form.id,
        profileId: input.profileId,
        deletedAt: { isNull: true },
      },
    });

    if (existing) {
      const [updated] = await tx
        .update(customFormSubmissions)
        .set({ data: input.data })
        .where(eq(customFormSubmissions.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await tx
      .insert(customFormSubmissions)
      .values({
        customFormId: form.id,
        profileId: input.profileId,
        data: input.data,
      })
      .returning();
    return inserted;
  });

  if (!submission) {
    throw new CommonError('Failed to record custom form submission');
  }

  return submission;
};
