import { type DbClient, db as defaultDb, eq } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessRolesWithOrgFallback } from '../access';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { createDecisionInstance } from './createInstanceFromTemplate';
import { decisionAdminPermissions } from './permissions';
import type {
  DecisionInstanceData,
  InstanceOverview,
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
  stewardProfileId?: string;
  include: DuplicateInstanceIncludeFlags;
  user: User;
};

/**
 * Duplicates a process instance into a new draft.
 * Validates the user, checks admin access on the source instance,
 * and delegates creation to createDecisionInstance.
 */
export const duplicateInstance = async ({
  instanceId,
  name,
  stewardProfileId,
  include,
  user,
}: DuplicateInstanceOptions) => {
  const dbUser = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must be authenticated'),
  );

  // Owner is always the individual creator.
  const ownerProfileId = dbUser.profileId;
  if (!ownerProfileId) {
    throw new UnauthorizedError('User must have a profile');
  }

  // Not `currentProfileId`: that is a last-viewed pointer, so the copy could
  // land off the duplicating user's process list.
  const resolvedStewardProfileId = stewardProfileId ?? ownerProfileId;

  if (!user.email) {
    throw new CommonError(
      'Failed to duplicate decision process instance. User email was missing',
    );
  }

  // Fetch source instance
  const sourceInstance = await defaultDb.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!sourceInstance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  if (!sourceInstance.profileId) {
    throw new CommonError('Source instance has no profile');
  }

  // Verify the caller has admin access on the source instance
  await assertProfileAccess({
    user,
    profileId: sourceInstance.profileId,
    permissions: decisionAdminPermissions,
  });

  // Org-fallback because org grants live on organizationUsers, not
  // profileUsers; the caller's own profile skips the check, having no role row.
  if (resolvedStewardProfileId !== ownerProfileId) {
    const stewardRoles = await getProfileAccessRolesWithOrgFallback({
      user,
      profileId: resolvedStewardProfileId,
    });

    if (!checkPermission({ profile: permission.ADMIN }, stewardRoles)) {
      throw new UnauthorizedError(
        'Not authorized to steward a process to this profile',
      );
    }
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
    stewardProfileId: resolvedStewardProfileId,
    creatorAuthUserId: user.id,
    creatorEmail: user.email,
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
    templateId: source.templateId,
    templateVersion: source.templateVersion,
    templateName: source.templateName,
    templateDescription: source.templateDescription,
    phases: buildPhases(source, include),
  };

  const config = buildConfig(source, include);
  if (config) {
    base.config = config;
  }

  if (include.processSettings) {
    if (source.overview) {
      const overview: InstanceOverview = { ...source.overview };
      // Storage object under the source instance's prefix, and clearing it
      // there deletes the object — sharing the path breaks the other's banner.
      delete overview.heroImage;

      if (Object.keys(overview).length > 0) {
        base.overview = overview;
      }
    }

    if (source.fieldValues) {
      base.fieldValues = source.fieldValues;
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

/** Process settings carry the config; category fields travel with proposalCategories. */
function buildConfig(
  source: DecisionInstanceData,
  include: DuplicateInstanceIncludeFlags,
): ProcessConfig | undefined {
  if (!source.config) {
    return undefined;
  }

  if (include.processSettings) {
    const config: ProcessConfig = { ...source.config };
    if (!include.proposalCategories) {
      for (const key of CATEGORY_KEYS) {
        delete config[key];
      }
    }
    return config;
  }

  if (!include.proposalCategories) {
    return undefined;
  }

  const config: ProcessConfig = {};
  for (const key of CATEGORY_KEYS) {
    if (source.config[key] !== undefined) {
      (config as any)[key] = source.config[key];
    }
  }
  return config;
}

/** Full phase copies when phases are included; otherwise identity-only references. */
function buildPhases(
  source: DecisionInstanceData,
  include: DuplicateInstanceIncludeFlags,
): PhaseInstanceData[] {
  if (!include.phases) {
    return source.phases.map(
      (phase): PhaseInstanceData => ({
        phaseId: phase.phaseId,
        name: phase.name,
        ...(include.reviewRubric && phase.rubricTemplate
          ? { rubricTemplate: phase.rubricTemplate }
          : {}),
      }),
    );
  }

  return source.phases.map((phase): PhaseInstanceData => {
    const copied: PhaseInstanceData = {
      phaseId: phase.phaseId,
      name: phase.name,
      description: phase.description,
      headline: phase.headline,
      additionalInfo: phase.additionalInfo,
      settingsSchema: phase.settingsSchema,
      settings: phase.settings,
      selectionPipeline: phase.selectionPipeline,
      // startDate and endDate intentionally omitted
    };

    if (include.reviewSettings) {
      copied.rules = phase.rules;
    }

    // Phase-level rubrics travel with the rubric flag, like the
    // instance-level template.
    if (include.reviewRubric && phase.rubricTemplate) {
      copied.rubricTemplate = phase.rubricTemplate;
    }

    return copied;
  });
}

/**
 * Copies custom roles (non-Admin, non-Participant) from source to target profile,
 * preserving their zone permissions.
 */
async function copyCustomRoles({
  sourceProfileId,
  targetProfileId,
  db = defaultDb,
}: {
  sourceProfileId: string;
  targetProfileId: string;
  db?: DbClient;
}) {
  // Fetch all roles for the source profile with their zone permissions
  const sourceRoles = await db._query.accessRoles.findMany({
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
    const [newRole] = await db
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

    // Copy zone permissions. Rows on profile-scoped roles are always global
    // (NULL profileId) — the role itself is the scope.
    if (role.zonePermissions.length > 0) {
      await db.insert(accessRolePermissionsOnAccessZones).values(
        role.zonePermissions.map((zp) => ({
          accessRoleId: newRole.id,
          accessZoneId: zp.accessZoneId,
          permission: zp.permission,
        })),
      );
    }
  }
}
