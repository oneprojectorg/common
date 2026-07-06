import { db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';

import type { CustomFormDefinitionSchema } from './schemas/customForm';

/**
 * Returns the custom form attached to `profileId` that applies to a given
 * decision phase.
 *
 * A profile may have several forms — at most one per phase — each tagged with
 * an `x-phase` designation in its `schema`. A form's effective phase is
 * `schema['x-phase']` when present, else `initialPhaseId` (so legacy forms with
 * no `x-phase` keep applying to the initial/submission phase).
 *
 * When `phaseId` is omitted, the first form attached to the profile is returned
 * (legacy, phase-agnostic behavior) for callers with no phase context.
 */
export const getCustomFormForProfile = async ({
  profileId,
  phaseId,
  initialPhaseId,
}: {
  profileId: string;
  phaseId?: string;
  initialPhaseId?: string;
}): Promise<CustomForm | null> => {
  if (!phaseId) {
    const form = await db.query.customForms.findFirst({
      where: {
        profileId,
        deletedAt: { isNull: true },
      },
    });

    return form ?? null;
  }

  const forms = await db.query.customForms.findMany({
    where: {
      profileId,
      deletedAt: { isNull: true },
    },
  });

  const match = forms.find((form) => {
    const xPhase = (form.schema as CustomFormDefinitionSchema)['x-phase'];
    const effectivePhase = xPhase ?? initialPhaseId;
    return effectivePhase === phaseId;
  });

  return match ?? null;
};
