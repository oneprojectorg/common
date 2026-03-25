import { db, eq } from '@op/db/client';
import { ProposalStatus, organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, collapseRoles, permission } from 'access-zones';
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
  collapseRoles(roles)['decisions'] ?? 0;

const resolveInstanceAccess = async (
  user: { id: string },
  instance: { profileId: string; ownerProfileId: string | null },
  profileUser: Awaited<ReturnType<typeof getProfileAccessUser>>,
): Promise<DecisionRolePermissions> => {
  if (profileUser) {
    // Profile admins bypass decision-zone role checks — they have full access
    if (checkPermission({ profile: permission.ADMIN }, profileUser.roles)) {
      return ALL_TRUE_ACCESS;
    }
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

  // This should be unreachable: assertInstanceProfileAccess guarantees the user
  // has either a profile or org role before resolveInstanceAccess is called.
  throw new UnauthorizedError("You don't have access to do this");
};

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  try {
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
      with: {
        process: true,
        owner: true,
        steward: true,
        proposals: {
          columns: {
            id: true,
            status: true,
            submittedByProfileId: true,
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

    // Fetch profileUser and assert access in parallel — both need the instance
    // but are independent of each other.
    const [profileUser] = await Promise.all([
      instance.profileId
        ? getProfileAccessUser({ user, profileId: instance.profileId })
        : Promise.resolve(undefined),
      assertInstanceProfileAccess({
        user,
        instance,
        profilePermissions: { decisions: permission.READ },
        orgFallbackPermissions: { decisions: permission.READ },
      }),
    ]);

    // Resolve access capabilities for the current user.
    // profileId is guaranteed non-null here: assertInstanceProfileAccess throws above if null.
    if (!instance.profileId) {
      throw new NotFoundError('Process instance not found');
    }
    const access = await resolveInstanceAccess(
      user,
      {
        profileId: instance.profileId,
        ownerProfileId: instance.ownerProfileId,
      },
      profileUser,
    );

    // Calculate proposal and participant counts
    const nonDraftProposals =
      instance.proposals.filter(
        (proposal) => proposal.status !== ProposalStatus.DRAFT,
      ) || [];
    const proposalCount = nonDraftProposals.length;
    const uniqueParticipants = new Set(
      nonDraftProposals.map((proposal) => proposal.submittedByProfileId),
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
