import { type DbClient, db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { type NormalizedRole, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  isUserEmailPlatformAdmin,
} from '../access';
import { getPhases } from '../decision/instancePhases';
import { resolveInstanceAccess } from '../decision/resolveInstanceAccess';
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

/** True when the user holds any of the decision capabilities the form lists. */
export const hasFormCapabilities = async ({
  user,
  form,
}: {
  user: AccessUser;
  form: Pick<CustomForm, 'profileId' | 'schema'>;
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

  if (!instance?.profileId) {
    return false;
  }

  let profileRoles: NormalizedRole[];
  try {
    profileRoles = await assertInstanceProfileAccess({
      user,
      instance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: { decisions: permission.READ },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return false;
    }
    throw error;
  }

  // The same rule getInstance gives the UI: admins hold every capability, and
  // org roles count only for a user with no role on the decision.
  const access = await resolveInstanceAccess({
    user,
    instance: {
      profileId: instance.profileId,
      ownerProfileId: instance.ownerProfileId,
    },
    profileRoles,
  });

  return capabilities.some((capability) => access[capability]);
};
