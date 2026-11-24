import { type DbClient, db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  isUserEmailPlatformAdmin,
} from '../access';
import { getPhases } from '../decision/instancePhases';
import { decisionPermission } from '../decision/permissions';
import type { CustomFormCapability } from './schemas/customForm';
import { getFormRequiredCapabilities } from './utils';

export type CustomFormProcessContext = {
  profileId: string;
};

export type CustomFormPhaseSet = {
  /** Phase a form with no `x-phase` falls back to. */
  initialPhaseId: string | null;
  phaseIds: string[];
};

/** The instance columns the authorization rule reads. */
export type CustomFormInstance = {
  id: string;
  profileId: string | null;
  ownerProfileId: string | null;
  instanceData: unknown;
};

/** Admits a platform admin or an admin on the profile's decision process. */
export const assertCustomFormAdmin = async ({
  user,
  profileId,
}: {
  user: User;
  profileId: string;
}): Promise<CustomFormProcessContext & { instance: CustomFormInstance }> => {
  // One instance per profile: the column holds the instance's own profile.
  const instance = await db.query.processInstances.findFirst({
    where: { profileId },
    columns: {
      id: true,
      profileId: true,
      ownerProfileId: true,
      instanceData: true,
    },
  });

  if (!instance) {
    throw new NotFoundError('Decision process', profileId);
  }

  return {
    ...(await assertCustomFormAdminForInstance({ user, instance })),
    instance,
  };
};

/**
 * The same rule against an instance the caller already loaded, so a path that
 * reached it by join doesn't re-query it.
 */
export const assertCustomFormAdminForInstance = async ({
  user,
  instance,
}: {
  user: User;
  instance: CustomFormInstance;
}): Promise<CustomFormProcessContext> => {
  const isPlatformAdmin = !!user.email && isUserEmailPlatformAdmin(user.email);

  if (!isPlatformAdmin) {
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance,
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: { decisions: permission.ADMIN },
    });
  }

  // The column is nullable and the platform-admin path skips the assert above.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  return { profileId: instance.profileId };
};

export const readInstancePhaseSet = async ({
  instance,
  db,
}: {
  instance: { id: string; instanceData: unknown };
  db?: DbClient;
}): Promise<CustomFormPhaseSet> => {
  const phaseIds = (await getPhases({ instance, db })).map(
    (phase) => phase.phaseId,
  );

  return { initialPhaseId: phaseIds[0] ?? null, phaseIds };
};

const CAPABILITY_PERMISSIONS: Record<CustomFormCapability, number> = {
  review: decisionPermission.REVIEW,
  vote: decisionPermission.VOTE,
  submitProposals: decisionPermission.SUBMIT_PROPOSALS,
  developProposals: decisionPermission.DEVELOP_PROPOSALS,
};

/** True when the user holds every decision capability the form requires. */
export const hasFormCapabilities = async ({
  user,
  form,
}: {
  user: AccessUser;
  form: CustomForm;
}): Promise<boolean> => {
  const capabilities = getFormRequiredCapabilities(form.schema);

  if (!capabilities) {
    return false;
  }

  if (capabilities.length === 0) {
    return true;
  }

  const instance = await db.query.processInstances.findFirst({
    where: { profileId: form.profileId },
    columns: { profileId: true, ownerProfileId: true },
  });

  if (!instance) {
    return false;
  }

  const decisions = capabilities.reduce<number>(
    (bits, capability) => bits | CAPABILITY_PERMISSIONS[capability],
    permission.READ,
  );

  try {
    await assertInstanceProfileAccess({
      user,
      instance,
      profilePermissions: { decisions },
      orgFallbackPermissions: { decisions },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return false;
    }
    throw error;
  }

  return true;
};
