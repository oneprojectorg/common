import { db, eq } from '@op/db/client';
import type { CustomForm, CustomFormSubmission } from '@op/db/schema';
import { customFormSubmissions } from '@op/db/schema';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { assertDecisionProfileReadAccess } from '../decision/assertDecisionProfileReadAccess';
import { schemaValidator } from '../decision/schemaValidator';
import { readInstancePhaseSet } from './customFormAuth';
import type {
  CreateCustomFormSubmissionInput,
  CustomFormDefinitionSchema,
} from './schemas/customForm';
import { getEffectiveFormPhase, getFormShowOn } from './utils';

/**
 * Records a submission against a custom form, attached to the target
 * entity's profile (`profileId`).
 *
 * Authorization: the caller must hold profile access on the TARGET profile
 * (for a proposal attachment, the proposal's own profile — its creator and
 * collaborators). The target must also belong to the form's owning process,
 * via one of these attachment sites:
 *   - for a form that opens on phase entry, the caller's own profile, when
 *     they can read the process;
 *   - otherwise, a proposal whose decision process owns the form
 *     (submission/edit forms),
 *   - a participant's own profile that has voted in the process (post-vote
 *     forms), or
 *   - a reviewer's own profile with a review assignment in the form's phase
 *     (review-phase forms).
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

  // The target profile must belong to the process that owns the form
  // (`form.profileId` is the process instance's profile). This stops a caller
  // from attaching their own entity to an unrelated form.
  if (getFormShowOn(form.schema) === 'entry') {
    await assertEntryFormParticipant({
      participantProfileId: input.profileId,
      form,
      authUserId,
    });
  } else {
    await assertActionFormTarget({ targetProfileId: input.profileId, form });
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

/** Anyone who can read the process answers an entry form, on their own profile. */
const assertEntryFormParticipant = async ({
  participantProfileId,
  form,
  authUserId,
}: {
  participantProfileId: string;
  form: CustomForm;
  authUserId: string;
}): Promise<void> => {
  const user = await assertUserByAuthId(authUserId);

  if (user.profileId !== participantProfileId) {
    throw new ValidationError(
      'The submission target does not belong to this form',
    );
  }

  await assertDecisionProfileReadAccess({
    user: { id: authUserId },
    profileId: form.profileId,
  });
};

const assertActionFormTarget = async ({
  targetProfileId,
  form,
}: {
  targetProfileId: string;
  form: CustomForm;
}): Promise<void> => {
  const proposal = await db.query.proposals.findFirst({
    where: { profileId: targetProfileId },
    with: { processInstance: true },
  });

  const belongsViaProposal =
    !!proposal && proposal.processInstance.profileId === form.profileId;

  const belongsToForm =
    belongsViaProposal ||
    (await isParticipantInFormProcess({
      participantProfileId: targetProfileId,
      form,
    }));

  if (!belongsToForm) {
    throw new ValidationError(
      'The submission target does not belong to this form',
    );
  }
};

const isParticipantInFormProcess = async ({
  participantProfileId,
  form,
}: {
  participantProfileId: string;
  form: CustomForm;
}): Promise<boolean> => {
  const instance = await db.query.processInstances.findFirst({
    where: { profileId: form.profileId },
    columns: { id: true, instanceData: true },
  });

  if (!instance) {
    return false;
  }

  // A reviewer answers only the form of a phase they review in.
  const formPhaseId =
    getEffectiveFormPhase({ schema: form.schema }) ??
    (await readInstancePhaseSet({ instance })).initialPhaseId;

  const [vote, reviewAssignment] = await Promise.all([
    db.query.decisionsVoteSubmissions.findFirst({
      where: {
        processInstanceId: instance.id,
        submittedByProfileId: participantProfileId,
      },
      columns: { id: true },
    }),
    formPhaseId
      ? db.query.proposalReviewAssignments.findFirst({
          where: {
            processInstanceId: instance.id,
            reviewerProfileId: participantProfileId,
            phaseId: formPhaseId,
          },
          columns: { id: true },
        })
      : undefined,
  ]);

  return !!vote || !!reviewAssignment;
};
