import { db, eq, inArray } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
  resourceCollections,
  resources,
  users,
} from '@op/db/schema';

import { createAuthenticatedCaller } from '../supabase-utils';
import { TestDecisionsDataManager } from './TestDecisionsDataManager';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

export const requireFirstInstance = <T extends { profileId: string }>(
  instances: T[],
): T => {
  const instance = instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  return instance;
};

/**
 * Pins the user's currentProfileId to a decision instance so that
 * `getCurrentProfileId(authUserId)` returns it. switchProfile only allows
 * org/individual profiles, so we hit the row directly for instance profiles.
 */
export const pinCurrentProfile = async (email: string, profileId: string) => {
  await db
    .update(users)
    .set({ currentProfileId: profileId })
    .where(eq(users.email, email));
};

/**
 * Cleans up every resource + collection visible to any of the given profile
 * IDs. Resources are removed before collections so we don't leave orphan
 * resource rows behind (the FK only cascades collection→items, not the
 * opposite direction).
 */
export const registerResourcesCleanup = (
  onTestFinished: OnTestFinished,
  profileIds: string[],
) => {
  onTestFinished(async () => {
    if (profileIds.length === 0) {
      return;
    }

    const collectionRows = await db
      .select({ id: resourceCollectionProfiles.collectionId })
      .from(resourceCollectionProfiles)
      .where(inArray(resourceCollectionProfiles.profileId, profileIds));

    if (collectionRows.length === 0) {
      return;
    }

    const collectionIds = collectionRows.map((row) => row.id);

    const items = await db
      .select({ resourceId: resourceCollectionItems.resourceId })
      .from(resourceCollectionItems)
      .where(inArray(resourceCollectionItems.collectionId, collectionIds));

    if (items.length > 0) {
      await db.delete(resources).where(
        inArray(
          resources.id,
          items.map((row) => row.resourceId),
        ),
      );
    }

    await db
      .delete(resourceCollections)
      .where(inArray(resourceCollections.id, collectionIds));
  });
};

export const resourceExists = async (id: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  return Boolean(row);
};

export type InstanceSetup = Awaited<
  ReturnType<TestDecisionsDataManager['createDecisionSetup']>
>;
export type InstanceRow = InstanceSetup['instances'][number];

/**
 * One-stop fixture: creates a TestDecisionsDataManager, a decision setup with
 * one instance, registers resources cleanup, and returns the admin tRPC caller.
 *
 * Use `pinAdmin: true` for procedures that resolve scope via
 * `getCurrentProfileId(authUserId)` (update / reorder / delete /
 * createLink with `kind: 'collection'`, etc.). Without it those calls would
 * resolve to the admin's individual profile, not the instance profile.
 */
export const setupInstance = async ({
  task,
  onTestFinished,
  pinAdmin = false,
}: {
  task: { id: string };
  onTestFinished: OnTestFinished;
  pinAdmin?: boolean;
}) => {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instance = requireFirstInstance(setup.instances);
  registerResourcesCleanup(onTestFinished, [instance.profileId]);

  if (pinAdmin) {
    await pinCurrentProfile(setup.userEmail, instance.profileId);
  }

  const adminCaller = await createAuthenticatedCaller(setup.userEmail);

  return { testData, setup, instance, adminCaller };
};

/**
 * Spins up a member user inside the same org as `setup`, granted access to the
 * given instance profile, and returns an authenticated tRPC caller for them.
 * Pass `pin: true` for procedures that read `currentProfileId`.
 */
export const createMemberCaller = async ({
  testData,
  setup,
  instanceProfileId,
  pin = false,
}: {
  testData: TestDecisionsDataManager;
  setup: InstanceSetup;
  instanceProfileId: string;
  pin?: boolean;
}) => {
  const member = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [instanceProfileId],
  });
  if (pin) {
    await pinCurrentProfile(member.email, instanceProfileId);
  }
  const caller = await createAuthenticatedCaller(member.email);
  return { member, caller };
};

/**
 * Builds an authenticated caller for a user who has zero access to the target
 * instance — they belong to a separate, brand-new org with no instances of
 * their own.
 */
export const createOutsiderCaller = async (
  testData: TestDecisionsDataManager,
) => {
  const outsiderSetup = await testData.createDecisionSetup({
    instanceCount: 0,
  });
  const outsider = await testData.createMemberUser({
    organization: outsiderSetup.organization,
    instanceProfileIds: [],
  });
  const caller = await createAuthenticatedCaller(outsider.email);
  return { outsider, caller };
};
