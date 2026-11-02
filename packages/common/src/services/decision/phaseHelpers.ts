import { type DbClient, asc, db, eq, inArray } from '@op/db/client';
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
import { isDeepStrictEqual } from 'node:util';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { schemaValidator } from './schemaValidator';
import {
  type PhaseInstanceData,
  type PhaseSettingsSchema,
  assertSettingsMatchSchema,
} from './schemas/instanceData';
import { MAX_PHASES_PER_DECISION } from './utils/phaseOrder';

// phaseId and name live on the phase's profile.
export type PhaseData = Omit<PhaseInstanceData, 'phaseId' | 'name'>;

// TODO: drop phaseId from row data once every reference uses the row id.
type PhaseRowData = PhaseData & { phaseId?: string };

type InstanceDataPhase = Pick<PhaseInstanceData, 'phaseId' | 'name'>;

export interface DecisionPhase {
  id: string;
  profileId: string;
  sortOrder: number;
  data: PhaseRowData;
  name: string;
  slug: string;
}

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
  tx: DbClient;
  processInstanceId: string;
  name: string;
  sortOrder: number;
  data?: PhaseRowData;
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

/** The decision's phases in order, each with the name its profile holds. */
export const listPhases = async ({
  db,
  processInstanceId,
}: {
  db: DbClient;
  processInstanceId: string;
}): Promise<DecisionPhase[]> => {
  const phases = await db
    .select({
      id: processPhases.id,
      profileId: processPhases.profileId,
      sortOrder: processPhases.sortOrder,
      data: processPhases.data,
      name: profiles.name,
      slug: profiles.slug,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(eq(processPhases.processInstanceId, processInstanceId))
    .orderBy(asc(processPhases.sortOrder), asc(processPhases.id));

  return phases.map((phase) => ({
    ...phase,
    data: readPhaseRowData(phase.data),
  }));
};

/**
 * Makes `existing`, loaded under the instance lock, match `phases` in that
 * order. A phase the list leaves out is deleted with its profile; one the list
 * leaves as it is stays untouched.
 */
export const reconcilePhases = async ({
  db,
  processInstanceId,
  existing,
  phases,
}: {
  db: DbClient;
  processInstanceId: string;
  existing: DecisionPhase[];
  phases: PhaseInstanceData[];
}): Promise<void> => {
  assertPhasesCanBeMinted(phases);

  const existingByPhaseId = new Map(
    existing.map((phase) => [phaseIdOf(phase), phase]),
  );

  for (const [sortOrder, phase] of phases.entries()) {
    const current = existingByPhaseId.get(phase.phaseId);
    const { name: _name, ...data } = phase;
    const name = getPhaseProfileName(phase);

    if (!current) {
      await insertPhase({ tx: db, processInstanceId, name, sortOrder, data });
      continue;
    }

    if (
      current.sortOrder !== sortOrder ||
      !isDeepStrictEqual(current.data, data)
    ) {
      await db
        .update(processPhases)
        .set({ sortOrder, data })
        .where(eq(processPhases.id, current.id));
    }

    if (current.name !== name) {
      await db
        .update(profiles)
        .set({ name })
        .where(eq(profiles.id, current.profileId));
    }
  }

  const listed = new Set(phases.map(({ phaseId }) => phaseId));
  const removed = existing
    .filter((phase) => !listed.has(phaseIdOf(phase)))
    .map((phase) => phase.profileId);
  if (removed.length > 0) {
    await db.delete(profiles).where(inArray(profiles.id, removed));
  }
};

// A phase minted from `instance_data` carries that phase's id; one made by the
// phase endpoints has only its slug, which is just as stable.
export const phaseIdOf = (phase: DecisionPhase): string =>
  phase.data.phaseId ?? phase.slug;

export const getPhaseProfileName = ({
  phaseId,
  name,
}: InstanceDataPhase): string => name?.trim() || phaseId;

export const assertPhaseCountFits = (count: number): void => {
  if (count > MAX_PHASES_PER_DECISION) {
    throw new ValidationError(
      `A decision can have at most ${MAX_PHASES_PER_DECISION} phases`,
      { phases: `Remove ${count - MAX_PHASES_PER_DECISION}` },
    );
  }
};

// TODO: remove once rows stop carrying phaseId and nothing mints from instance_data.
export const assertPhasesCanBeMinted = (
  phases: readonly InstanceDataPhase[],
): void => {
  const phaseIds = new Set<string>();
  for (const phase of phases) {
    if (!phase.phaseId) {
      throw new ValidationError('There is a phase with no id', {
        phaseId: 'Required',
      });
    }
    if (phaseIds.has(phase.phaseId)) {
      throw new ValidationError(
        `There are two phases with the id "${phase.phaseId}"`,
        { phaseId: 'Must be unique' },
      );
    }
    phaseIds.add(phase.phaseId);
  }
};

export const assertPhaseSchemasCompile = ({
  rubricTemplate,
  proposalTemplate,
  settingsSchema,
}: Pick<
  PhaseData,
  'rubricTemplate' | 'proposalTemplate' | 'settingsSchema'
>): void => {
  if (rubricTemplate) {
    schemaValidator.validateJsonSchema(rubricTemplate);
  }
  if (proposalTemplate) {
    schemaValidator.validateJsonSchema(proposalTemplate);
  }
  if (settingsSchema) {
    const { ui: _ui, ...schema } = settingsSchema;
    schemaValidator.validateJsonSchema(schema);
  }
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
}): Promise<{ profileId: string; processInstanceId: string }> => {
  const phase = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { profileId: true, processInstanceId: true },
    with: { processInstance: { columns: { profileId: true } } },
  });

  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }

  await assertDecisionAdmin({
    user,
    decisionProfileId: phase.processInstance.profileId,
  });

  return {
    profileId: phase.profileId,
    processInstanceId: phase.processInstanceId,
  };
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
  tx: DbClient;
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

// Shape only; the fields are checked where they are used.
const isPhaseRowData = (value: unknown): value is PhaseRowData =>
  isJsonObject(value);

const readPhaseRowData = (data: unknown): PhaseRowData =>
  isPhaseRowData(data) ? data : {};

// Shape only; Ajv compiles it when the settings are checked.
const isSettingsSchema = (value: unknown): value is PhaseSettingsSchema =>
  isJsonObject(value);
