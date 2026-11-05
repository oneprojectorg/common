import {
  type DbClient,
  type TransactionType,
  asc,
  db,
  eq,
  inArray,
} from '@op/db/client';
import {
  EntityType,
  type ProcessPhase,
  ProcessStatus,
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
import {
  PHASE_NAME_TOO_LONG,
  phaseNameLengthSchema,
} from './schemas/phaseName';
import { MAX_PHASES_PER_DECISION } from './utils/phaseOrder';

export { MAX_PHASES_PER_DECISION };

// phaseId and name live on the phase's profile.
export type PhaseData = Omit<PhaseInstanceData, 'phaseId' | 'name'>;

// TODO: drop phaseId from row data once every reference uses the row id.
export type PhaseRowData = PhaseData & { phaseId?: string };

type InstanceDataPhase = Pick<PhaseInstanceData, 'phaseId' | 'name'>;

export interface ProcessPhaseWithProfile {
  id: string;
  profileId: string;
  sortOrder: number;
  data: PhaseRowData;
  name: string;
  slug: string;
}

const SLUG_ATTEMPTS = 3;

export const listPhasesByInstance = async ({
  db,
  processInstanceIds,
}: {
  db: DbClient;
  processInstanceIds: string[];
}): Promise<Map<string, ProcessPhaseWithProfile[]>> => {
  const phasesByInstance = new Map<string, ProcessPhaseWithProfile[]>();

  if (processInstanceIds.length === 0) {
    return phasesByInstance;
  }

  const rows = await db
    .select({
      processInstanceId: processPhases.processInstanceId,
      id: processPhases.id,
      profileId: processPhases.profileId,
      sortOrder: processPhases.sortOrder,
      data: processPhases.data,
      name: profiles.name,
      slug: profiles.slug,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(inArray(processPhases.processInstanceId, processInstanceIds))
    .orderBy(
      asc(processPhases.processInstanceId),
      asc(processPhases.sortOrder),
      asc(processPhases.createdAt),
      asc(processPhases.id),
    );

  for (const { processInstanceId, ...phase } of rows) {
    const phases = phasesByInstance.get(processInstanceId) ?? [];
    phases.push({ ...phase, data: readPhaseRowData(phase.data) });
    phasesByInstance.set(processInstanceId, phases);
  }

  return phasesByInstance;
};

export const listPhases = async ({
  db,
  processInstanceId,
}: {
  db: DbClient;
  processInstanceId: string;
}): Promise<ProcessPhaseWithProfile[]> =>
  (
    await listPhasesByInstance({ db, processInstanceIds: [processInstanceId] })
  ).get(processInstanceId) ?? [];

// Checked on the rows a write leaves, so every writer refuses the same states.
export const assertPhaseRowInvariants = ({
  rows,
  previousPhaseIds,
  instance,
}: {
  rows: ProcessPhaseWithProfile[];
  previousPhaseIds: readonly string[];
  instance: { status: string | null; currentStateId: string | null };
}): void => {
  // A decision with no phases cannot advance or publish.
  if (rows.length === 0) {
    throw new ValidationError('A decision must keep at least one phase', {
      phases: 'Keep at least one phase',
    });
  }
  assertPhaseCountFits(rows.length);

  const { status, currentStateId } = instance;
  if (
    status !== ProcessStatus.DRAFT &&
    currentStateId !== null &&
    previousPhaseIds.includes(currentStateId) &&
    !rows.some((row) => phaseIdOf(row) === currentStateId)
  ) {
    throw new ValidationError('The current phase cannot be deleted', {
      phases: 'Move the decision to another phase first',
    });
  }
};

export const toInstanceDataPhase = (
  phase: ProcessPhaseWithProfile,
): PhaseInstanceData => ({
  ...phase.data,
  phaseId: phaseIdOf(phase),
  name: phase.name,
});

// TODO: drop once transitions are keyed on phase rows alone.
export const resolveTransitionPhaseRowIds = <
  T extends { fromStateId: string | null; toStateId: string },
>({
  phases,
  transitions,
}: {
  phases: ProcessPhaseWithProfile[];
  transitions: T[];
}): (T & { fromPhaseId: string | null; toPhaseId: string | null })[] => {
  const rowIdByPhaseId = new Map(
    phases.map((phase) => [phaseIdOf(phase), phase.id]),
  );

  return transitions.map((transition) => ({
    ...transition,
    fromPhaseId:
      transition.fromStateId === null
        ? null
        : (rowIdByPhaseId.get(transition.fromStateId) ?? null),
    toPhaseId: rowIdByPhaseId.get(transition.toStateId) ?? null,
  }));
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

// Upserts rows keyed on phaseId; a phase left out is deleted with its profile.
export const reconcilePhases = async ({
  tx,
  processInstanceId,
  existing,
  phases,
}: {
  tx: TransactionType;
  processInstanceId: string;
  existing: ProcessPhaseWithProfile[];
  phases: readonly PhaseInstanceData[];
}): Promise<ProcessPhaseWithProfile[]> => {
  assertPhaseCountFits(phases.length);
  assertPhasesCanBeMinted(phases);
  assertPhaseNamesFit(phases);

  const existingByPhaseId = new Map(
    existing.map((phase) => [phaseIdOf(phase), phase]),
  );
  const rows: ProcessPhaseWithProfile[] = [];

  for (const [sortOrder, phase] of phases.entries()) {
    const current = existingByPhaseId.get(phase.phaseId);
    const { name: _name, ...data } = phase;
    const name = getPhaseProfileName(phase);

    if (!current) {
      const inserted = await insertPhase({
        tx,
        processInstanceId,
        name,
        sortOrder,
        data,
      });
      rows.push({
        id: inserted.phase.id,
        profileId: inserted.profile.id,
        sortOrder,
        data,
        name: inserted.profile.name,
        slug: inserted.profile.slug,
      });
      continue;
    }
    rows.push({ ...current, sortOrder, data, name });

    if (
      current.sortOrder !== sortOrder ||
      !isDeepStrictEqual(current.data, data)
    ) {
      await tx
        .update(processPhases)
        .set({ sortOrder, data })
        .where(eq(processPhases.id, current.id));
    }

    if (current.name !== name) {
      await tx
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
    // The profile cascades to the phase row.
    await tx.delete(profiles).where(inArray(profiles.id, removed));
  }

  return rows;
};

// TODO: remove once references store the row id instead of data.phaseId.
export const phaseIdOf = (phase: ProcessPhaseWithProfile): string =>
  phase.data.phaseId ?? phase.slug;

export const assertPhaseCountFits = (count: number): void => {
  if (count > MAX_PHASES_PER_DECISION) {
    throw new ValidationError(
      `A decision can have at most ${MAX_PHASES_PER_DECISION} phases`,
      { phases: `Remove ${count - MAX_PHASES_PER_DECISION}` },
    );
  }
};

// TODO: remove once rows stop carrying phaseId.
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

export const assertPhaseNamesFit = (
  phases: readonly InstanceDataPhase[],
): void => {
  for (const phase of phases) {
    const name = getPhaseProfileName(phase);
    if (!phaseNameLengthSchema.safeParse(name).success) {
      throw new ValidationError(PHASE_NAME_TOO_LONG, {
        name: `Shorten "${name.slice(0, 24)}…"`,
      });
    }
  }
};

const getPhaseProfileName = ({ phaseId, name }: InstanceDataPhase): string =>
  name?.trim() || phaseId;

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

const isPhaseRowData = (value: unknown): value is PhaseRowData =>
  isJsonObject(value);

const readPhaseRowData = (data: unknown): PhaseRowData =>
  isPhaseRowData(data) ? data : {};

// Shape only; Ajv compiles it when the settings are checked.
const isSettingsSchema = (value: unknown): value is PhaseSettingsSchema =>
  isJsonObject(value);
