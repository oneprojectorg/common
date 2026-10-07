import { type TransactionType, db } from '@op/db/client';
import {
  EntityType,
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { schemaValidator } from './schemaValidator';
import {
  type PhaseInstanceData,
  type PhaseOverride,
  type PhaseSettingsSchema,
  assertSettingsMatchSchema,
} from './schemas/instanceData';

// phaseId and name live on the phase's profile.
export type PhaseData = Omit<PhaseInstanceData, 'phaseId' | 'name'>;

export type PhaseDataInput = Omit<PhaseOverride, 'phaseId' | 'name'> &
  Pick<PhaseInstanceData, 'settingsSchema' | 'selectionPipeline'>;

type ClearablePhaseField = 'headline' | 'rubricTemplate';

const SLUG_ATTEMPTS = 3;

// Callers authorize first. Settings are unchecked: legacy instance data can
// hold settings without a schema, and conversion copies it.
export const insertPhase = async ({
  tx,
  processInstanceId,
  name,
  sortOrder,
  data,
  generateSlug = generatePhaseSlug,
}: {
  tx: TransactionType;
  processInstanceId: string;
  name: string;
  sortOrder: number;
  data?: PhaseData;
  // Only tests pass this, to force slug clashes.
  generateSlug?: () => string;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  const profile = await insertPhaseProfile({ tx, name, generateSlug });

  const [phase] = await tx
    .insert(processPhases)
    .values({
      processInstanceId,
      sortOrder,
      profileId: profile.id,
      data: data ?? {},
    })
    .returning();

  if (!phase) {
    throw new CommonError('Failed to create phase');
  }

  return { phase, profile };
};

export const toPhaseDataPatch = (
  input: PhaseDataInput,
): { set: PhaseData; clear: ClearablePhaseField[] } => {
  const { headline, rubricTemplate, ...rest } = input;

  if (rubricTemplate != null) {
    schemaValidator.validateJsonSchema(rubricTemplate);
  }
  if (rest.settingsSchema) {
    const { ui: _ui, ...settingsSchema } = rest.settingsSchema;
    schemaValidator.validateJsonSchema(settingsSchema);
  }

  const clear: ClearablePhaseField[] = [];
  if (headline === null) {
    clear.push('headline');
  }
  if (rubricTemplate === null) {
    clear.push('rubricTemplate');
  }

  return {
    set: {
      ...rest,
      ...(headline != null && { headline }),
      ...(rubricTemplate != null && { rubricTemplate }),
    },
    clear,
  };
};

type PhaseSettingsFields = Pick<PhaseData, 'settings' | 'settingsSchema'>;

export const assertPhaseSettings = ({
  data,
  phaseLabel,
}: {
  data: PhaseSettingsFields;
  phaseLabel: string;
}): void => {
  if (!data.settings) {
    return;
  }
  if (!data.settingsSchema) {
    throw new ValidationError('Phase settings need a settings schema', {
      settingsSchema: 'Required when settings are given',
    });
  }
  assertSettingsMatchSchema({
    settings: data.settings,
    settingsSchema: data.settingsSchema,
    phaseLabel,
  });
};

export const readPhaseSettings = (data: unknown): PhaseSettingsFields => {
  if (!isJsonObject(data)) {
    return {};
  }
  return {
    ...(isJsonObject(data.settings) && { settings: data.settings }),
    ...(isSettingsSchema(data.settingsSchema) && {
      settingsSchema: data.settingsSchema,
    }),
  };
};

export const getPhaseAsDecisionAdmin = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<{ profileId: string }> => {
  const phase = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { profileId: true },
    with: { processInstance: { columns: { profileId: true } } },
  });

  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }

  await assertDecisionAdmin({
    user,
    decisionProfileId: phase.processInstance.profileId,
  });

  return { profileId: phase.profileId };
};

export const assertDecisionAdmin = async ({
  user,
  decisionProfileId,
}: {
  user: User;
  decisionProfileId: string | null;
}): Promise<void> => {
  // Legacy instances can lack a profile.
  if (!decisionProfileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({
    user,
    profileId: decisionProfileId,
    permissions: { decisions: permission.ADMIN },
  });
};

const insertPhaseProfile = async ({
  tx,
  name,
  generateSlug,
}: {
  tx: TransactionType;
  name: string;
  generateSlug: () => string;
}): Promise<Profile> => {
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const [profile] = await tx
      .insert(profiles)
      .values({
        type: EntityType.PHASE,
        name,
        slug: generateSlug(),
      })
      .onConflictDoNothing({ target: profiles.slug })
      .returning();

    if (profile) {
      return profile;
    }
  }

  throw new CommonError('Failed to create phase profile');
};

const generatePhaseSlug = () => randomUUID().slice(0, 8);

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Shape only; Ajv compiles it when the settings are checked.
const isSettingsSchema = (value: unknown): value is PhaseSettingsSchema =>
  isJsonObject(value);
