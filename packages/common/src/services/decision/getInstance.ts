import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import { ProposalStatus, organizations } from '@op/db/schema';
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
  /**
   * Skip the viewer-independent instance cache and fetch directly from the DB.
   * Edit flows (e.g. ProcessBuilder autosave) pass `true` so the editor always
   * reflects the writer's own changes immediately — the cache layer is read-
   * only consistent across nodes, but a writer who just mutated should never
   * see its own pre-mutation snapshot.
   */
  skipCache?: boolean;
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

const loadInstanceFromDb = async (instanceId: string) => {
  const instance = await db.query.processInstances.findFirst({
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
  });

  if (!instance) {
    return null;
  }

  const manualSelectionStatus = await resolveManualSelectionStatus({
    instance: {
      id: instance.id,
      instanceData: instance.instanceData,
      currentStateId: instance.currentStateId,
    },
  });

  return {
    instance,
    selectionsAreConfirmed: manualSelectionStatus.selectionsAreConfirmed,
  };
};

export const getInstance = async ({
  instanceId,
  user,
  skipCache = false,
}: GetInstanceInput) => {
  try {
    // The instance row + manualSelectionStatus are viewer-independent; the
    // READ gate and user-specific access bits stay outside the cache so a hit
    // can never bypass authorization or leak another viewer's permissions.
    const loaded = skipCache
      ? await loadInstanceFromDb(instanceId)
      : await cache({
          type: 'decision',
          params: [instanceId, 'instance'],
          fetch: () => loadInstanceFromDb(instanceId),
        });

    if (!loaded) {
      throw new NotFoundError('Process instance', instanceId);
    }

    const { instance, selectionsAreConfirmed } = loaded;

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

    return {
      ...instance,
      slug: instance.profile?.slug ?? null,
      instanceData: filteredInstanceData,
      proposalCount,
      participantCount,
      access,
      selectionsAreConfirmed,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching process instance:', error);
    throw new NotFoundError('Process instance', instanceId);
  }
};
