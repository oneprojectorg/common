import { type DbClient, db as defaultDb, eq } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessRolesWithOrgFallback } from '../access';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { createDecisionInstance } from './createInstanceFromTemplate';
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
    permissions: { decisions: permission.ADMIN },
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
    phases: [],
  };

  const config = copyConfig(source, include);
  if (config) {
    base.config = config;
  }

  if (include.processSettings) {
    const overview = copyOverview(source);
    if (overview) {
      base.overview = overview;
    }

    if (source.fieldValues) {
      base.fieldValues = source.fieldValues;
    }
  }

  // Phases
  if (include.phases && source.phases.length > 0) {
    base.phases = source.phases.map((phase) =>
      copyPhaseDetails(phase, include),
    );
  } else if (source.phases.length > 0) {
    // Even without phase details, we need at least minimal phase references
    base.phases = source.phases.map((phase) =>
      copyPhaseReference(phase, include),
    );
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

// Config minus the category fields, unless proposalCategories is included too;
// or only the category fields, when that is all that is included.
function copyConfig(
  source: DecisionInstanceData,
  include: DuplicateInstanceIncludeFlags,
): ProcessConfig | undefined {
  if (!source.config) {
    return undefined;
  }

  if (include.processSettings) {
    return include.proposalCategories
      ? { ...source.config }
      : withoutCategoryFields(source.config);
  }

  return include.proposalCategories
    ? onlyCategoryFields(source.config)
    : undefined;
}

function withoutCategoryFields(source: ProcessConfig): ProcessConfig {
  const config: ProcessConfig = { ...source };
  for (const key of CATEGORY_KEYS) {
    delete config[key];
  }
  return config;
}

function onlyCategoryFields(source: ProcessConfig): ProcessConfig {
  const config: ProcessConfig = {};
  for (const key of CATEGORY_KEYS) {
    if (source[key] !== undefined) {
      (config as any)[key] = source[key];
    }
  }
  return config;
}

// The hero image is a storage object under the source instance's prefix, and
// clearing it there deletes the object; sharing the path breaks the other's banner.
function copyOverview(
  source: DecisionInstanceData,
): InstanceOverview | undefined {
  if (!source.overview) {
    return undefined;
  }

  const overview: InstanceOverview = { ...source.overview };
  delete overview.heroImage;

  return Object.keys(overview).length > 0 ? overview : undefined;
}

function copyPhaseDetails(
  phase: PhaseInstanceData,
  include: DuplicateInstanceIncludeFlags,
): PhaseInstanceData {
  const copied: PhaseInstanceData = {
    phaseId: phase.phaseId,
    name: phase.name,
    description: phase.description,
    headline: phase.headline,
    additionalInfo: phase.additionalInfo,
    settingsSchema: phase.settingsSchema,
    settings: phase.settings,
    selectionPipeline: phase.selectionPipeline,
    selectionNeedsApproval: phase.selectionNeedsApproval,
    // Strip dates
    // startDate and endDate intentionally omitted
  };

  // Include review settings (phase-level rules) if requested
  if (include.reviewSettings) {
    copied.rules = phase.rules;
  }

  // Phase-level rubrics travel with the rubric flag, like the
  // instance-level template below.
  if (include.reviewRubric && phase.rubricTemplate) {
    copied.rubricTemplate = phase.rubricTemplate;
  }

  return copied;
}

function copyPhaseReference(
  phase: PhaseInstanceData,
  include: DuplicateInstanceIncludeFlags,
): PhaseInstanceData {
  return {
    phaseId: phase.phaseId,
    name: phase.name,
    // Minimal phase - just identity, plus the phase rubric when the
    // rubric flag asks for it.
    ...(include.reviewRubric && phase.rubricTemplate
      ? { rubricTemplate: phase.rubricTemplate }
      : {}),
  };
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
