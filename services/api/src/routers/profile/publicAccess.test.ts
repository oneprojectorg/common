import {
  UnauthorizedError,
  assertProfileAccess,
  decisionPermission,
  isProfilePublic,
  makeProfilePublic,
  revokeProfilePublicAccess,
} from '@op/common';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';

/**
 * Opening a profile to the public.
 *
 * Built on `TestDecisionsDataManager` because it creates a real organization —
 * a `profiles` row *and* the `organizations` row behind it, with the caller
 * holding an org-level grant. `TestProfileUserDataManager` makes an org-typed
 * profile with no organization behind it, which production never has, and the
 * org authorization path cannot be exercised against it.
 *
 * A stranger is a bare auth id holding no grant. That is what makes these
 * assertions mean something: the only thing that can admit them is the grant on
 * the public sentinel, which `resolveAccessUserIds` unions in.
 */
describe.concurrent('public profile access', () => {
  it('admits a stranger to an organization it opened', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });

    await makeProfilePublic({
      profileId: setup.organization.profileId,
      user: { id: setup.user.id },
    });

    const roles = await assertProfileAccess({
      user: { id: randomUUID() },
      profileId: setup.organization.profileId,
      permissions: { profile: permission.READ },
    });

    expect(roles.length).toBeGreaterThan(0);
  });

  it('opens a decision for participation, not just reading', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });

    await makeProfilePublic({
      profileId: setup.instance.profileId,
      user: { id: setup.user.id },
    });

    // A public process nobody outside the network can join is not public in
    // any useful sense, so the decision grant carries submit and vote.
    const roles = await assertProfileAccess({
      user: { id: randomUUID() },
      profileId: setup.instance.profileId,
      permissions: {
        decisions:
          permission.READ |
          decisionPermission.SUBMIT_PROPOSALS |
          decisionPermission.VOTE,
      },
    });

    expect(roles.length).toBeGreaterThan(0);
  });

  it('does not let the public write to it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });

    await makeProfilePublic({
      profileId: setup.organization.profileId,
      user: { id: setup.user.id },
    });

    // The grant is permission bits on one profile, not a bypass. If this ever
    // passes, every public profile is world-writable.
    await expect(
      assertProfileAccess({
        user: { id: randomUUID() },
        profileId: setup.organization.profileId,
        permissions: { profile: permission.UPDATE },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('closes again when the grant is revoked', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const profileId = setup.organization.profileId;
    const admin = { id: setup.user.id };

    await makeProfilePublic({ profileId, user: admin });
    expect(await isProfilePublic(profileId)).toBe(true);

    // Revoking has to keep working after opening. The public grant lands on
    // `profileUsers`, which would otherwise shadow the org fallback and leave
    // the organization's own admin unable to close what they opened.
    await revokeProfilePublicAccess({ profileId, user: admin });
    expect(await isProfilePublic(profileId)).toBe(false);

    // A stranger who never asked before: the answer for one who did is cached
    // under their own id, and this service cannot reach that key.
    await expect(
      assertProfileAccess({
        user: { id: randomUUID() },
        profileId,
        permissions: { profile: permission.READ },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('is idempotent', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const profileId = setup.organization.profileId;
    const admin = { id: setup.user.id };

    await makeProfilePublic({ profileId, user: admin });
    await makeProfilePublic({ profileId, user: admin });

    const roles = await assertProfileAccess({
      user: { id: randomUUID() },
      profileId,
      permissions: { profile: permission.READ },
    });

    expect(roles.length).toBeGreaterThan(0);
  });

  it('refuses a caller who does not administer the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });

    await expect(
      makeProfilePublic({
        profileId: setup.organization.profileId,
        user: { id: randomUUID() },
      }),
    ).rejects.toThrow(UnauthorizedError);

    expect(await isProfilePublic(setup.organization.profileId)).toBe(false);
  });
});
