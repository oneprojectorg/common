import {
  TestDecisionsDataManager,
  createDecisionsAdmin,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { db } from '@op/db/client';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { updateProfileUserRoles } from '../profile/updateProfileUserRole';
import { backfillDevelopedProposalCoauthors } from './backfillDevelopedProposalCoauthors';
import { createDevelopedProposal } from './createDevelopedProposal';
import { getProposal } from './getProposal';
import { submitManualSelection } from './submitManualSelection';

async function createDevelopedEntry(
  testData: TestDecisionsDataManager,
  { sourceCount = 1 }: { sourceCount?: number } = {},
) {
  const { setup, instanceId, source, otherSources } =
    await createDevelopPhaseSetup({ testData, sourceCount });
  const developer = await createDevelopProposalsMember({ testData, setup });
  const entry = await createDevelopedProposal({
    data: {
      processInstanceId: instanceId,
      sourceProposalIds: [source.id, ...otherSources.map(({ id }) => id)],
      proposalData: { title: 'Developed' },
    },
    user: developer.user,
  });
  testData.trackProfileForCleanup(entry.profileId);

  return { setup, instanceId, source, entry };
}

async function readMembershipCount({
  profileId,
  authUserId,
}: {
  profileId: string;
  authUserId: string;
}) {
  const memberships = await db.query.profileUsers.findMany({
    where: { profileId, authUserId },
    columns: { id: true },
  });
  return memberships.length;
}

describe.concurrent('backfillDevelopedProposalCoauthors', () => {
  it('adds a member who became an admin to an existing entry once, so they can read the draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, entry } = await createDevelopedEntry(testData, {
      sourceCount: 2,
    });
    const admin = await createDecisionsAdmin({ testData, setup });

    await expect(
      getProposal({ profileId: entry.profileId, user: admin.user }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });

    await expect(
      backfillDevelopedProposalCoauthors({
        instanceId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toEqual({ added: 1 });

    const read = await getProposal({
      profileId: entry.profileId,
      user: admin.user,
    });
    expect(read.id).toBe(entry.id);

    await expect(
      backfillDevelopedProposalCoauthors({
        instanceId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toEqual({ added: 0 });
    await expect(
      readMembershipCount({
        profileId: entry.profileId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toBe(1);
  });

  it('skips a member without the admin permission', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, entry } = await createDevelopedEntry(testData);
    const developer = await createDevelopProposalsMember({ testData, setup });

    await expect(
      backfillDevelopedProposalCoauthors({
        instanceId,
        authUserId: developer.authUserId,
      }),
    ).resolves.toEqual({ skipped: 'member is not an admin of the decision' });
    await expect(
      readMembershipCount({
        profileId: entry.profileId,
        authUserId: developer.authUserId,
      }),
    ).resolves.toBe(0);
  });

  it('adds nothing once the selections of the develop phase are confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, entry } =
      await createDevelopedEntry(testData);
    const admin = await createDecisionsAdmin({ testData, setup });
    await submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [source.id],
      user: setup.user,
    });

    await expect(
      backfillDevelopedProposalCoauthors({
        instanceId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toEqual({ skipped: 'develop window is not open' });
    await expect(
      readMembershipCount({
        profileId: entry.profileId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toBe(0);
  });

  it('keeps the memberships of a member who stops being an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, entry } = await createDevelopedEntry(testData);
    const admin = await createDecisionsAdmin({ testData, setup });
    await backfillDevelopedProposalCoauthors({
      instanceId,
      authUserId: admin.authUserId,
    });

    const decisionMembership = await db.query.profileUsers.findFirst({
      where: {
        profileId: setup.instance.profileId,
        authUserId: admin.authUserId,
      },
      columns: { id: true },
    });
    if (!decisionMembership) {
      throw new Error('Expected a decision membership for the admin');
    }
    await updateProfileUserRoles({
      profileUserId: decisionMembership.id,
      roleIds: [ROLES.MEMBER.id],
      user: setup.user,
    });

    await expect(
      backfillDevelopedProposalCoauthors({
        instanceId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toEqual({ skipped: 'member is not an admin of the decision' });
    await expect(
      readMembershipCount({
        profileId: entry.profileId,
        authUserId: admin.authUserId,
      }),
    ).resolves.toBe(1);
  });
});
