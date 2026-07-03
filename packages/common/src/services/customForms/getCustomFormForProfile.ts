import { db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';

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
}): Promise<CustomForm | null> => {
  const form = await db.query.customForms.findFirst({
    where: {
      profileId,
      deletedAt: { isNull: true },
    },
  });

  return form ?? null;
};
