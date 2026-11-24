import {
  and,
  db,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
} from '@op/db/client';
import type { CustomForm, CustomFormSubmission } from '@op/db/schema';
import { customFormSubmissions, proposals } from '@op/db/schema';

import { assertUserByAuthId } from '../assert';
import { assertDecisionProfileReadAccess } from '../decision/assertDecisionProfileReadAccess';
import { hasFormCapabilities } from './customFormAuth';
import type { CustomFormShowOn } from './schemas/customForm';
import { getEffectiveFormPhase, getFormShowOn } from './utils';

/**
 * Returns the custom form attached to `profileId` that the caller still owes an
 * answer for in a given decision phase, or null when there is none.
 *
 * A profile may have several forms — at most one per phase — each tagged with
 * an `x-phase` designation in its `schema`. A form's effective phase is
 * `schema['x-phase']` when present, else `initialPhaseId` (so legacy forms with
 * no `x-phase` keep applying to the initial/submission phase).
 *
 * A form is asked once per person per phase, so a caller who already submitted
 * the matched form gets null. A form set to open at a moment other than
 * `showOn`, or one whose listed capabilities the caller holds none of, also gets null.
 *
 * When `phaseId` is omitted, the first form attached to the profile is returned
 * (legacy, phase-agnostic behavior) for callers with no phase context.
 */
export const getCustomFormForProfile = async ({
  profileId,
  phaseId,
  initialPhaseId,
  showOn = 'action',
  authUserId,
}: {
  profileId: string;
  phaseId?: string;
  initialPhaseId?: string;
  showOn?: CustomFormShowOn;
  authUserId: string;
}): Promise<CustomForm | null> => {
  const [, form] = await Promise.all([
    assertDecisionProfileReadAccess({
      user: { id: authUserId },
      profileId,
    }),
    getFormForPhase({ profileId, phaseId, initialPhaseId, showOn }),
  ]);

  if (
    !form ||
    !(await hasFormCapabilities({ user: { id: authUserId }, form }))
  ) {
    return null;
  }

  const answer = await getCallerSubmission({ formId: form.id, authUserId });

  return answer ? null : form;
};

const getFormForPhase = async ({
  profileId,
  phaseId,
  initialPhaseId,
  showOn,
}: {
  profileId: string;
  phaseId?: string;
  initialPhaseId?: string;
  showOn: CustomFormShowOn;
}): Promise<CustomForm | null> => {
  const forms = await db.query.customForms.findMany({
    where: {
      profileId,
      deletedAt: { isNull: true },
    },
  });

  const match = forms.find(
    (form) =>
      getFormShowOn(form.schema) === showOn &&
      (!phaseId ||
        getEffectiveFormPhase({ schema: form.schema, initialPhaseId }) ===
          phaseId),
  );

  return match ?? null;
};

/**
 * The caller's own answer to a form, or null when they have not given one.
 *
 * A submission row points at the entity the answers were collected against, not
 * at the person who gave them — the proposal's profile for a submission form,
 * the participant's own profile for a post-vote or review-phase one. Every
 * attachment site `createCustomFormSubmission` accepts is resolved back to the
 * caller here.
 */
const getCallerSubmission = async ({
  formId,
  authUserId,
}: {
  formId: string;
  authUserId: string;
}): Promise<CustomFormSubmission | null> => {
  const user = await assertUserByAuthId(authUserId);

  // A proposal records the profile its author was acting as, which can be an
  // organization; a vote records their individual profile. Either one answering
  // counts as this person answering.
  const callerProfileIds = [
    ...new Set([user.profileId, user.currentProfileId]),
  ].filter((id): id is string => id != null);

  if (callerProfileIds.length === 0) {
    return null;
  }

  const [answer] = await db
    .select(getTableColumns(customFormSubmissions))
    .from(customFormSubmissions)
    .leftJoin(
      proposals,
      eq(proposals.profileId, customFormSubmissions.profileId),
    )
    .where(
      and(
        eq(customFormSubmissions.customFormId, formId),
        isNull(customFormSubmissions.deletedAt),
        or(
          inArray(customFormSubmissions.profileId, callerProfileIds),
          inArray(proposals.submittedByProfileId, callerProfileIds),
        ),
      ),
    )
    .limit(1);

  return answer ?? null;
};
