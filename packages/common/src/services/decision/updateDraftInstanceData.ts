import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertProfileAdmin } from '../assert';
import { schemaValidator } from './schemaValidator';
import {
  type PhaseOverride,
  draftInstanceDataSchema,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';

/**
 * Updates a decision process instance's draft data.
 *
 * All edits are written to the `draftInstanceData` column only — the live
 * columns (`instanceData`, `name`, `description`) are untouched. To promote
 * draft edits to the live version, use `publishDecisionInstance`.
 */
export const updateDraftInstanceData = async ({
  instanceId,
  name,
  description,
  stewardProfileId,
  config,
  phases,
  proposalTemplate,
  rubricTemplate,
  user,
}: {
  instanceId: string;
  name?: string;
  description?: string;
  stewardProfileId?: string;
  config?: ProcessConfig;
  phases?: PhaseOverride[];
  proposalTemplate?: Record<string, unknown>;
  rubricTemplate?: Record<string, unknown>;
  user: User;
}) => {
  const existingInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!existingInstance) {
    throw new NotFoundError('Process instance not found');
  }

  const { profileId } = existingInstance;
  if (!profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  if (proposalTemplate !== undefined) {
    schemaValidator.validateJsonSchema(proposalTemplate);
  }
  if (rubricTemplate !== undefined) {
    schemaValidator.validateJsonSchema(rubricTemplate);
  }

  if (
    stewardProfileId !== undefined &&
    stewardProfileId !== existingInstance.stewardProfileId
  ) {
    if (!existingInstance.ownerProfileId) {
      throw new UnauthorizedError(
        'Only the process owner can change the steward',
      );
    }
    await assertProfileAdmin(user, existingInstance.ownerProfileId);
  }

  // Merge incoming fields into existing draft data.
  // Fall back to {} only when the column is null (pre-migration instance).
  // If the column has data but fails parsing, that's corruption — don't
  // silently discard the existing draft.
  const parsed = draftInstanceDataSchema.safeParse(
    existingInstance.draftInstanceData,
  );
  let existingDraft: Record<string, unknown>;
  if (parsed.success) {
    existingDraft = parsed.data as Record<string, unknown>;
  } else if (existingInstance.draftInstanceData != null) {
    throw new CommonError(
      'Existing draft data is malformed and cannot be updated safely',
    );
  } else {
    existingDraft = {};
  }
  const updatedDraft: Record<string, unknown> = { ...existingDraft };

  if (name !== undefined) {
    updatedDraft.name = name;
  }
  if (description !== undefined) {
    updatedDraft.description = description;
  }
  if (stewardProfileId !== undefined) {
    updatedDraft.stewardProfileId = stewardProfileId;
  }
  if (config !== undefined) {
    const existingConfig =
      typeof existingDraft.config === 'object' && existingDraft.config
        ? existingDraft.config
        : {};
    updatedDraft.config = {
      ...existingConfig,
      ...config,
    };
  }
  if (phases !== undefined) {
    updatedDraft.phases = phases;
  }
  if (proposalTemplate !== undefined) {
    updatedDraft.proposalTemplate = proposalTemplate;
  }
  if (rubricTemplate !== undefined) {
    updatedDraft.rubricTemplate = rubricTemplate;
  }

  await db
    .update(processInstances)
    .set({ draftInstanceData: updatedDraft })
    .where(eq(processInstances.id, instanceId));

  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    with: { processInstance: true },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch updated decision profile');
  }

  return profile;
};
