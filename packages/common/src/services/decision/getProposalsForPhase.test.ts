import {
  TestDecisionsDataManager,
  schemaWithoutPipeline,
} from '@op/common/testing';
import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { getPhaseProposalAndDraftIds } from './getProposalsForPhase';

describe.concurrent('getPhaseProposalAndDraftIds', () => {
  it('splits the current phase into submitted proposals and the caller’s own drafts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const { instance } = setup.instance;
    const [creator, otherMember] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [setup.instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [setup.instance.profileId],
      }),
    ]);
    const [submitted, draft] = await Promise.all([
      testData.createProposal({
        userEmail: creator.email,
        processInstanceId: instance.id,
        proposalData: { title: `Submitted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: creator.email,
        processInstanceId: instance.id,
        proposalData: { title: `Draft ${task.id}` },
      }),
    ]);

    const [forCreator, forOtherMember] = await Promise.all([
      getPhaseProposalAndDraftIds({
        instance,
        authUserIds: [creator.authUserId],
      }),
      getPhaseProposalAndDraftIds({
        instance,
        authUserIds: [otherMember.authUserId],
      }),
    ]);

    expect(forCreator).toEqual({
      nonDraftIds: [submitted.id],
      draftIds: [draft.id],
    });
    expect(forOtherMember).toEqual({
      nonDraftIds: [submitted.id],
      draftIds: [],
    });
  });
});
