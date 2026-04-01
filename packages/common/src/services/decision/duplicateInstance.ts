import { type TransactionType, db, eq } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';

import { CommonError, NotFoundError } from '../../utils';
import { createDecisionInstance } from './createInstanceFromTemplate';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';

export type DuplicateInstanceIncludeFlags = {
  processSettings: boolean;
  phases: boolean;
  proposalCategories: boolean;
  proposalTemplate: boolean;
  reviewSettings: boolean;
  reviewRubric: boolean;
  roles: boolean;
};

export type DuplicateInstanceOptions = {
  instanceId: string;
  name: string;
  ownerProfileId: string;
  /** Defaults to ownerProfileId when not provided */
  stewardProfileId?: string;
  creatorAuthUserId: string;
  creatorEmail: string;
  include: DuplicateInstanceIncludeFlags;
};

/**
 * Duplicates a process instance into a new draft with selectable include options.
 * Delegates core creation to createDecisionInstance, then copies custom roles separately.
 */
export const duplicateInstance = async ({
  instanceId,
  name,
  ownerProfileId,
  stewardProfileId,
  creatorAuthUserId,
  creatorEmail,
  include,
}: DuplicateInstanceOptions) => {
  // Fetch source instance
  const sourceInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!sourceInstance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!sourceInstance.profileId) {
    throw new CommonError('Source instance has no profile');
  }

  if (!sourceInstance.processId) {
    throw new CommonError('Source instance has no process template');
  }

  const sourceData = sourceInstance.instanceData as DecisionInstanceData | null;
  if (!sourceData) {
    throw new CommonError('Source instance has no instance data');
  }

  // Build new instance data based on include flags
  const newInstanceData = buildInstanceData(sourceData, include);

  // Delegate core creation (profile, instance, default roles, profile user)
  const profile = await createDecisionInstance({
    processId: sourceInstance.processId,
    name,
    description: sourceInstance.description ?? undefined,
    ownerProfileId,
    stewardProfileId,
    creatorAuthUserId,
    creatorEmail,
    instanceData: newInstanceData,
  });

  // Copy custom roles from source if requested (separate step because
  // custom role copying works with raw DB records, not CustomRoleDefinition)
  if (include.roles && profile.processInstance) {
    await copyCustomRoles({
      sourceProfileId: sourceInstance.profileId,
      targetProfileId: profile.id,
    });
  }

  return profile;
};

/** Category-related config keys */
const CATEGORY_KEYS = [
  'categories',
  'requireCategorySelection',
  'allowMultipleCategories',
  'organizeByCategories',
] as const;

/**
 * Builds the new instance data by selectively copying from the source
 * based on include flags.
 */
function buildInstanceData(
  source: DecisionInstanceData,
  include: DuplicateInstanceIncludeFlags,
): DecisionInstanceData {
  // Always copy template reference metadata
  const base: DecisionInstanceData = {
    currentPhaseId: '',
    templateId: source.templateId,
    templateVersion: source.templateVersion,
    templateName: source.templateName,
    templateDescription: source.templateDescription,
    phases: [],
  };

  // Process settings (config minus category fields unless proposalCategories is also included)
  if (include.processSettings && source.config) {
    const config: ProcessConfig = { ...source.config };

    if (!include.proposalCategories) {
      // Strip category-related fields from config
      for (const key of CATEGORY_KEYS) {
        delete config[key];
      }
    }

    base.config = config;
  } else if (include.proposalCategories && source.config) {
    // Only category fields from config
    const config: ProcessConfig = {};
    for (const key of CATEGORY_KEYS) {
      if (source.config[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (config as any)[key] = source.config[key];
      }
    }
    base.config = config;
  }

  // Phases
  if (include.phases && source.phases.length > 0) {
    base.phases = source.phases.map((phase): PhaseInstanceData => {
      const copied: PhaseInstanceData = {
        phaseId: phase.phaseId,
        name: phase.name,
        description: phase.description,
        headline: phase.headline,
        additionalInfo: phase.additionalInfo,
        settingsSchema: phase.settingsSchema,
        settings: phase.settings,
        selectionPipeline: phase.selectionPipeline,
        // Strip dates
        // startDate and endDate intentionally omitted
      };

      // Include review settings (phase-level rules) if requested
      if (include.reviewSettings) {
        copied.rules = phase.rules;
      }

      return copied;
    });
    base.currentPhaseId = base.phases[0]!.phaseId;
  } else {
    // Even without phases, we need at least a reference from source
    // to have a valid currentPhaseId
    if (source.phases.length > 0) {
      base.phases = source.phases.map(
        (phase): PhaseInstanceData => ({
          phaseId: phase.phaseId,
          name: phase.name,
          // Minimal phase - just identity
        }),
      );
      base.currentPhaseId = base.phases[0]!.phaseId;
    }
  }

  // Proposal template
  if (include.proposalTemplate && source.proposalTemplate) {
    base.proposalTemplate = source.proposalTemplate;
  }

  // Review rubric
  if (include.reviewRubric && source.rubricTemplate) {
    base.rubricTemplate = source.rubricTemplate;
  }

  return base;
}

/**
 * Copies custom roles (non-Admin, non-Participant) from source to target profile,
 * preserving their zone permissions.
 */
async function copyCustomRoles({
  sourceProfileId,
  targetProfileId,
  tx,
}: {
  sourceProfileId: string;
  targetProfileId: string;
  tx?: TransactionType;
}) {
  const client = tx ?? db;

  // Fetch all roles for the source profile with their zone permissions
  const sourceRoles = await client._query.accessRoles.findMany({
    where: eq(accessRoles.profileId, sourceProfileId),
    with: {
      zonePermissions: true,
    },
  });

  // Filter to custom roles only (skip default Admin and Participant)
  const customRoles = sourceRoles.filter(
    (role) => role.name !== 'Admin' && role.name !== 'Participant',
  );

  for (const role of customRoles) {
    // Create the role on the new profile
    const [newRole] = await client
      .insert(accessRoles)
      .values({
        name: role.name,
        description: role.description,
        profileId: targetProfileId,
      })
      .returning();

    if (!newRole) {
      throw new CommonError(`Failed to create custom role: ${role.name}`);
    }

    // Copy zone permissions
    if (role.zonePermissions.length > 0) {
      await client.insert(accessRolePermissionsOnAccessZones).values(
        role.zonePermissions.map((zp) => ({
          accessRoleId: newRole.id,
          accessZoneId: zp.accessZoneId,
          permission: zp.permission,
        })),
      );
    }
  }
}
