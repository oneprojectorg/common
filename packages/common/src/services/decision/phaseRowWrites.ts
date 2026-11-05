import type { TransactionType } from '@op/db/client';
import {
  EntityType,
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { CommonError, ValidationError } from '../../utils/error';
import type { PhaseInstanceData } from './schemas/instanceData';
import {
  PHASE_NAME_TOO_LONG,
  phaseNameLengthSchema,
} from './schemas/phaseName';
import { MAX_PHASES_PER_DECISION } from './utils/phaseOrder';

// Phase row writes that take a transaction and never import the db client.

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

const getPhaseProfileName = ({ phaseId, name }: InstanceDataPhase): string =>
  name?.trim() || phaseId;

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
