import { db, eq, sql } from '@op/db/client';
import {
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  type PhaseData,
  assertPhaseSchemasCompile,
  assertPhaseSettings,
  getPhaseAsDecisionAdmin,
  readPhaseSettings,
} from './phaseHelpers';
import type { PhaseOverride } from './schemas/instanceData';

type ClearablePhaseField = 'headline' | 'rubricTemplate';

// `null` on a clearable field deletes the stored key.
export type PhaseDataUpdate = Omit<PhaseOverride, 'phaseId' | 'name'> &
  Pick<PhaseData, 'settingsSchema' | 'selectionPipeline'>;

export const updatePhase = async ({
  user,
  phaseId,
  name,
  data,
}: {
  user: User;
  phaseId: string;
  name?: string;
  data?: PhaseDataUpdate;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  if (name === undefined && data === undefined) {
    throw new ValidationError('Nothing to update');
  }
  const patch = data === undefined ? undefined : toPhaseDataPatch(data);
  // Only when touched: converted legacy phases can hold settings with no schema.
  const touchesSettings =
    patch !== undefined &&
    (patch.set.settings !== undefined ||
      patch.set.settingsSchema !== undefined);

  const { profileId } = await getPhaseAsDecisionAdmin({ user, phaseId });

  return db.transaction(async (tx) => {
    const [profile] =
      name === undefined
        ? await tx.select().from(profiles).where(eq(profiles.id, profileId))
        : await tx
            .update(profiles)
            .set({ name })
            .where(eq(profiles.id, profileId))
            .returning();

    const [phase] =
      patch === undefined
        ? await tx
            .select()
            .from(processPhases)
            .where(eq(processPhases.id, phaseId))
        : await tx
            .update(processPhases)
            .set({
              data: patch.clear.reduce(
                (merged, key) => sql`${merged} - ${key}::text`,
                sql`(${processPhases.data} || ${JSON.stringify(patch.set)}::jsonb)`,
              ),
            })
            .where(eq(processPhases.id, phaseId))
            .returning();

    if (!profile || !phase) {
      throw new NotFoundError('Phase', phaseId);
    }

    // Checked on the merged row so a failure rolls the write back.
    if (touchesSettings) {
      assertPhaseSettings({
        data: readPhaseSettings(phase.data),
        phaseLabel: profile.name,
      });
    }

    return { phase, profile };
  });
};

const toPhaseDataPatch = (
  input: PhaseDataUpdate,
): { set: PhaseData; clear: ClearablePhaseField[] } => {
  const { headline, rubricTemplate, ...rest } = input;

  const clear: ClearablePhaseField[] = [];
  if (headline === null) {
    clear.push('headline');
  }
  if (rubricTemplate === null) {
    clear.push('rubricTemplate');
  }

  const set: PhaseData = {
    ...rest,
    ...(headline != null && { headline }),
    ...(rubricTemplate != null && { rubricTemplate }),
  };
  assertPhaseSchemasCompile(set);

  return { set, clear };
};
