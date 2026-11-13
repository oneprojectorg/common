import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { getProposalDevelopAccess } from './getProposalDevelopAccess';

describe.concurrent('getProposalDevelopAccess', () => {
  it('returns admin and develop access for an admin of the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup } = await createDevelopPhaseSetup({ testData });

    await expect(
      getProposalDevelopAccess({
        profileId: setup.instance.profileId,
        user: { id: setup.user.id },
      }),
    ).resolves.toEqual({ isAdmin: true, canDevelop: true });
  });

  it('returns develop access without admin for a Develop Proposals holder', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup } = await createDevelopPhaseSetup({ testData });
    const developer = await createDevelopProposalsMember({ testData, setup });

    await expect(
      getProposalDevelopAccess({
        profileId: setup.instance.profileId,
        user: { id: developer.authUserId },
      }),
    ).resolves.toEqual({ isAdmin: false, canDevelop: true });
  });

  it('returns no access for a participant without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup } = await createDevelopPhaseSetup({ testData });
    const participant = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    await expect(
      getProposalDevelopAccess({
        profileId: setup.instance.profileId,
        user: { id: participant.authUserId },
      }),
    ).resolves.toEqual({ isAdmin: false, canDevelop: false });
  });

  it('returns no access for an admin of the owning organization with no role on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup } = await createDevelopPhaseSetup({ testData });
    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      orgRoleId: ROLES.ADMIN.id,
    });

    await expect(
      getProposalDevelopAccess({
        profileId: setup.instance.profileId,
        user: { id: orgAdmin.authUserId },
      }),
    ).resolves.toEqual({ isAdmin: false, canDevelop: false });
  });

  it('returns no access without a decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup } = await createDevelopPhaseSetup({ testData });

    await expect(
      getProposalDevelopAccess({
        profileId: null,
        user: { id: setup.user.id },
      }),
    ).resolves.toEqual({ isAdmin: false, canDevelop: false });
  });
});
