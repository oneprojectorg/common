import { InngestTestEngine } from '@inngest/test';
import { createDevelopedProposal } from '@op/common';
import {
  TestDecisionsDataManager,
  createDecisionsAdmin,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { db } from '@op/db/client';
import { Events } from '@op/events';
import { describe, expect, it } from 'vitest';

import { backfillDevelopedProposalCoauthorsOnRoleChange } from './backfillDevelopedProposalCoauthorsOnRoleChange';

const executeRolesChanged = (data: {
  decisionProfileId: string;
  authUserId: string;
}) =>
  new InngestTestEngine({
    function: backfillDevelopedProposalCoauthorsOnRoleChange,
  }).execute({
    events: [
      {
        name: Events.decisionMemberRolesChanged.name,
        data: { ...data, addedRoleIds: [], removedRoleIds: [] },
      },
    ],
  });

describe('backfillDevelopedProposalCoauthorsOnRoleChange', () => {
  it('makes a member who became an admin a co-author of the existing entry', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const developer = await createDevelopProposalsMember({ testData, setup });
    const entry = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: developer.user,
    });
    testData.trackProfileForCleanup(entry.profileId);
    const admin = await createDecisionsAdmin({ testData, setup });

    const { result, error } = await executeRolesChanged({
      decisionProfileId: setup.instance.profileId,
      authUserId: admin.authUserId,
    });

    expect(error).toBeUndefined();
    expect(result).toEqual({ backfill: { added: 1 } });
    const memberships = await db.query.profileUsers.findMany({
      where: { profileId: entry.profileId, authUserId: admin.authUserId },
      columns: { id: true },
    });
    expect(memberships).toHaveLength(1);
  });
});
