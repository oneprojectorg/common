import { db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { checkPermission, collapseRoles, permission } from 'access-zones';
import type { NormalizedRole } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  getOrgAccessUser,
} from '../access';
import { getCachedInstance } from './getCachedInstance';
import { resolvePhases } from './instancePhases';
import type { DecisionRolePermissions } from './permissions';
import { fromDecisionBitField } from './permissions';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface GetInstanceInput {
  instanceId: string;
  user: User | undefined;
}

const ALL_TRUE_ACCESS: DecisionRolePermissions = {
  delete: true,
  update: true,
  read: true,
  create: true,
  admin: true,
  inviteMembers: true,
  review: true,
  submitProposals: true,
  vote: true,
};

const getRolesDecisionBits = (roles: NormalizedRole[]): number =>
  collapseRoles(roles)['decisions'] ?? 0;

const resolveInstanceAccess = async (
  user: AccessUser | undefined,
  instance: { profileId: string; ownerProfileId: string | null },
  profileRoles: NormalizedRole[],
): Promise<DecisionRolePermissions> => {
  if (profileRoles.length > 0) {
    // Profile admins bypass decision-zone role checks — they have full access
    if (checkPermission({ profile: permission.ADMIN }, profileRoles)) {
      return ALL_TRUE_ACCESS;
    }
    return fromDecisionBitField(getRolesDecisionBits(profileRoles));
  }

  // Fall back to org-level roles
  if (instance.ownerProfileId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, instance.ownerProfileId));

    if (org?.id) {
      const orgUser = await getOrgAccessUser({ user, organizationId: org.id });
      if (orgUser) {
        return fromDecisionBitField(getRolesDecisionBits(orgUser.roles));
      }
    }
  }

  // This should be unreachable: assertInstanceProfileAccess guarantees the user
  // has either a profile or org role before resolveInstanceAccess is called.
  throw new UnauthorizedError("You don't have access to do this");
};

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  try {
    // Cached and viewer-independent; the access check + per-user access bits
    // below run on every call, outside the cache.
    const cached = await getCachedInstance(instanceId);

    if (!cached) {
      throw new NotFoundError('Process instance', instanceId);
    }

    const [instance, profileRoles] = await Promise.all([
      resolvePhases({ instance: cached }),
      assertInstanceProfileAccess({
        user,
        instance: cached,
        profilePermissions: { decisions: permission.READ },
        orgFallbackPermissions: { decisions: permission.READ },
      }),
    ]);

    // Resolve access capabilities for the current user.
    // profileId is guaranteed non-null here: assertInstanceProfileAccess throws above if null.
    if (!instance.profileId) {
      throw new NotFoundError('Process instance', instanceId);
    }
    const access = await resolveInstanceAccess(
      user,
      {
        profileId: instance.profileId,
        ownerProfileId: instance.ownerProfileId,
      },
      profileRoles,
    );

    // Filter budget from phase settings if hideBudget is true
    const instanceData = instance.instanceData as DecisionInstanceData;
    const phases = instanceData.config?.hideBudget
      ? instance.phases.map((phase) => ({
          ...phase,
          settings: phase.settings
            ? { ...phase.settings, budget: undefined }
            : phase.settings,
        }))
      : instance.phases;

    const manualSelectionStatus = await resolveManualSelectionStatus({
      instance,
    });

    return {
      ...instance,
      slug: instance.profile?.slug ?? null,
      instanceData,
      phases,
      access,
      selectionsAreConfirmed: manualSelectionStatus.selectionsAreConfirmed,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error('Error fetching process instance', { error });
    throw new NotFoundError('Process instance', instanceId);
  }
};
