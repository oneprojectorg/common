import { type TransactionType, db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  accessRolePermissionsOnAccessZones,
  accessRoles,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';

import { CommonError, NotFoundError } from '../../utils';
import { generateUniqueProfileSlug } from '../profile/utils';
import { createDecisionRole } from './decisionRoles';
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
 * Follows the same creation pattern as createInstanceFromTemplateCore.
 */
export const duplicateInstance = async ({
  instanceId,
  name,
  ownerProfileId,
  stewardProfileId = ownerProfileId,
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

  const sourceData = sourceInstance.instanceData as DecisionInstanceData | null;
  if (!sourceData) {
    throw new CommonError('Source instance has no instance data');
  }

  // Build new instance data based on include flags
  const newInstanceData = buildInstanceData(sourceData, include);

  const instance = await db.transaction(async (tx) => {
    // Create a DECISION profile for the new instance
    const slug = await generateUniqueProfileSlug({
      name: `decision-${name}`,
      db: tx,
    });

    const [instanceProfile] = await tx
      .insert(profiles)
      .values({
        type: EntityType.DECISION,
        name,
        slug,
      })
      .returning();

    if (!instanceProfile) {
      throw new CommonError('Failed to create decision instance profile');
    }

    // Create the new instance
    const [newInstance] = await tx
      .insert(processInstances)
      .values({
        processId: sourceInstance.processId,
        name,
        description: sourceInstance.description,
        instanceData: newInstanceData,
        currentStateId: newInstanceData.currentPhaseId,
        ownerProfileId,
        stewardProfileId,
        profileId: instanceProfile.id,
        status: ProcessStatus.DRAFT,
      })
      .returning();

    if (!newInstance) {
      throw new CommonError('Failed to create duplicated process instance');
    }

    // Create default roles (always created regardless of include.roles flag)
    const [adminRole] = await Promise.all([
      createDecisionRole({
        name: 'Admin',
        profileId: instanceProfile.id,
        permissions: {
          profile: {
            type: 'acrud',
            value: {
              admin: true,
              create: true,
              read: true,
              update: true,
              delete: true,
            },
          },
          decisions: {
            type: 'decision',
            value: {
              create: true,
              read: true,
              update: true,
              delete: true,
              admin: true,
              inviteMembers: true,
              review: true,
              submitProposals: true,
              vote: true,
            },
          },
        },
        tx,
      }),
      createDecisionRole({
        name: 'Participant',
        profileId: instanceProfile.id,
        permissions: {
          profile: {
            type: 'acrud',
            value: {
              admin: false,
              create: false,
              read: true,
              update: false,
              delete: false,
            },
          },
          decisions: {
            type: 'decision',
            value: {
              create: false,
              read: true,
              update: false,
              delete: false,
              admin: false,
              inviteMembers: false,
              review: false,
              submitProposals: true,
              vote: true,
            },
          },
        },
        tx,
      }),
    ]);

    // Copy custom roles from source if include.roles is true
    if (include.roles) {
      await copyCustomRoles({
        sourceProfileId: sourceInstance.profileId!,
        targetProfileId: instanceProfile.id,
        tx,
      });
    }

    // Add the creator as a profile user with Admin role
    const [newProfileUser] = await tx
      .insert(profileUsers)
      .values({
        profileId: instanceProfile.id,
        authUserId: creatorAuthUserId,
        email: creatorEmail,
        isOwner: true,
      })
      .returning();

    if (!newProfileUser) {
      throw new CommonError('Failed to add creator as profile user');
    }

    await tx.insert(profileUserToAccessRoles).values({
      profileUserId: newProfileUser.id,
      accessRoleId: adminRole.id,
    });

    return newInstance;
  });

  // Fetch the profile with processInstance joined for the response
  const profile = await db.query.profiles.findFirst({
    where: { id: instance.profileId! },
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch created decision profile');
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
  tx: TransactionType;
}) {
  // Fetch all roles for the source profile with their zone permissions
  const sourceRoles = await tx._query.accessRoles.findMany({
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
    const [newRole] = await tx
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
      await tx.insert(accessRolePermissionsOnAccessZones).values(
        role.zonePermissions.map((zp) => ({
          accessRoleId: newRole.id,
          accessZoneId: zp.accessZoneId,
          permission: zp.permission,
        })),
      );
    }
  }
}
