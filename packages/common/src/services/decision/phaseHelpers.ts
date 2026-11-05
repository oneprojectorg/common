import { type DbClient, asc, db, eq, inArray } from '@op/db/client';
import { ProcessStatus, processPhases, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  type ProcessPhaseWithProfile,
  type PhaseData,
  type PhaseRowData,
  assertPhaseCountFits,
  phaseIdOf,
} from './phaseRowWrites';
import { schemaValidator } from './schemaValidator';
import {
  type PhaseInstanceData,
  type PhaseSettingsSchema,
  assertSettingsMatchSchema,
} from './schemas/instanceData';

export {
  type ProcessPhaseWithProfile,
  type PhaseData,
  assertPhaseCountFits,
  assertPhaseNamesFit,
  assertPhasesCanBeMinted,
  insertPhase,
  phaseIdOf,
  reconcilePhases,
} from './phaseRowWrites';

export { MAX_PHASES_PER_DECISION } from './utils/phaseOrder';

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
  // With no rows, readers fall back to instanceData.phases and resurrect them.
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

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPhaseRowData = (value: unknown): value is PhaseRowData =>
  isJsonObject(value);

const readPhaseRowData = (data: unknown): PhaseRowData =>
  isPhaseRowData(data) ? data : {};

// Shape only; Ajv compiles it when the settings are checked.
const isSettingsSchema = (value: unknown): value is PhaseSettingsSchema =>
  isJsonObject(value);
