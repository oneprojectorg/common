import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import { ProposalStatus, organizations } from '@op/db/schema';
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
import type { DecisionRolePermissions } from './permissions';
import { fromDecisionBitField } from './permissions';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface GetInstanceInput {
  instanceId: string;
  user: User | undefined;
}

/**
 * What a profile admin gets on a decision process without holding a
 * decision-zone role: everything except `review`.
 *
 * `review` is deliberately absent. It is not a "can see more" bit — it marks a
 * member as an assignment candidate and drives the reviewer surfaces (the
 * assignment queue, the reviewer tab pair). Granting it to every profile admin
 * would make them reviewers of every process they administer, which is the
 * conflation the capability matrix removes. Admins keep their progress and
 * aggregate reads through `admin`, which every such gate checks.
 *
 * A profile admin who is also a real reviewer keeps `review` — see
 * `resolveInstanceAccess`, which ORs the actual grant back in.
 */
const PROFILE_ADMIN_ACCESS: DecisionRolePermissions = {
  delete: true,
  update: true,
  read: true,
  create: true,
  admin: true,
  inviteMembers: true,
  review: false,
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
    const roleAccess = fromDecisionBitField(getRolesDecisionBits(profileRoles));

    // Profile admins bypass decision-zone role checks. The bypass does not
    // confer `review` (see PROFILE_ADMIN_ACCESS), but it must not take away a
    // REVIEW grant the admin genuinely holds.
    if (checkPermission({ profile: permission.ADMIN }, profileRoles)) {
      return { ...PROFILE_ADMIN_ACCESS, review: roleAccess.review };
    }
    return roleAccess;
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
    // The DB load is viewer-independent, so cache it under `[id, 'instance']`.
    // The access check + per-user access bits run on every call, outside the
    // cache, so a hit can never bypass authorization.
    const instance = await cache({
      type: 'decision',
      params: [instanceId, 'instance'],
      fetch: () =>
        db.query.processInstances.findFirst({
          where: { id: instanceId },
          with: {
            process: true,
            owner: true,
            steward: true,
            profile: {
              columns: {
                slug: true,
              },
            },
            proposals: {
              columns: {
                id: true,
                status: true,
                submittedByProfileId: true,
              },
            },
          },
        }),
    });

    if (!instance) {
      throw new NotFoundError('Process instance', instanceId);
    }

    // Assert read access and reuse the profile-level roles it resolves.
    const profileRoles = await assertInstanceProfileAccess({
      user,
      instance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: { decisions: permission.READ },
    });

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

    const manualSelectionStatus = await resolveManualSelectionStatus({
      instance: {
        id: instance.id,
        instanceData: instance.instanceData,
        currentStateId: instance.currentStateId,
      },
    });

    return {
      ...instance,
      slug: instance.profile?.slug ?? null,
      instanceData: filteredInstanceData,
      proposalCount,
      participantCount,
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
