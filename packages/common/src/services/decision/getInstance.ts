import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import type { NormalizedRole } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getOrgAccessUser,
  getProfileAccessUser,
} from '../access';
import type { DecisionRolePermissions } from './permissions';
import { fromDecisionBitField } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface GetInstanceInput {
  instanceId: string;
  authUserId: string;
  user: User;
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
  roles.reduce((acc, role) => acc | (role.access['decisions'] ?? 0), 0);

const resolveInstanceAccess = async (
  user: { id: string },
  instance: { profileId: string | null; ownerProfileId: string | null },
): Promise<DecisionRolePermissions> => {
  if (!instance.profileId) {
    return ALL_TRUE_ACCESS;
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  if (profileUser) {
    return fromDecisionBitField(getRolesDecisionBits(profileUser.roles));
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

  // No role found (e.g. platform admin) — default to all capabilities
  return ALL_TRUE_ACCESS;
};

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  try {
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
      with: {
        process: true,
        owner: true,
        steward: true,
        proposals: {
          columns: {
            id: true,
            submittedByProfileId: true,
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

    await assertInstanceProfileAccess({
      user,
      instance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: { decisions: permission.READ },
    });

    // Resolve access capabilities for the current user
    const access = await resolveInstanceAccess(user, instance);

    // Calculate proposal and participant counts
    const proposalCount = instance.proposals?.length || 0;
    const uniqueParticipants = new Set(
      instance.proposals?.map((p) => p.submittedByProfileId),
    );
    const participantCount = uniqueParticipants.size;

    // Filter budget from phase settings if hideBudget is true
    const instanceData = instance.instanceData as DecisionInstanceData;
    const filteredInstanceData = instanceData.config?.hideBudget
      ? {
          ...instanceData,
          phases: instanceData.phases.map((phase) => ({
            ...phase,
            settings: phase.settings
              ? { ...phase.settings, budget: undefined }
              : phase.settings,
          })),
        }
      : instanceData;

    return {
      ...instance,
      instanceData: filteredInstanceData,
      proposalCount,
      participantCount,
      access,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching process instance:', error);
    throw new NotFoundError('Process instance not found');
  }
};
