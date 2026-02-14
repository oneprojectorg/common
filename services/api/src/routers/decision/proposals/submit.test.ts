import { ProposalStatus, processInstances, proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('submitProposal', () => {
  it('should submit a draft proposal successfully', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Valid Proposal',
        description: 'A complete proposal',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('should reject submitting an already-submitted proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Already Submitted', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // First submission should succeed
    await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    // Second submission should fail — proposal is no longer a draft
    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission when current phase disallows proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Phase Blocked', description: 'A test' },
    });

    // Advance instance to the 'final' phase which has proposals.submit = false
    // (testMinimalSchema: initial = submit:true, final = submit:false)
    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    await db
      .update(processInstances)
      .set({
        currentStateId: 'final',
        instanceData: {
          ...instanceData,
          currentPhaseId: 'final',
        },
      })
      .where(eq(processInstances.id, instance.instance.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission from a user without access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Unauthorized Proposal', description: 'A test' },
    });

    // Create a member user WITHOUT access to this decision's profile
    const outsider = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [], // no access to the instance profile
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toThrow();
  });

  it('should reject submission when required fields are missing from proposal data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a proposal with an empty title
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: '' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // submitProposal should validate against the proposalTemplate and reject
    // because title is empty (violates minLength: 1)
    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission when budget exceeds the template maximum', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title', 'budget'],
        properties: {
          title: { type: 'string' },
          budget: { type: 'number', maximum: 10000 },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a proposal, then directly overwrite proposalData
    // with a budget that exceeds the template maximum
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Over Budget Proposal' },
    });

    // Directly set invalid proposal data that exceeds the budget cap
    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Over Budget Proposal',
          collaborationDocId: `proposal-${proposal.id}`,
          budget: 99999,
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // submitProposal should validate against the template and reject
    // because budget 99999 > maximum 10000
    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });
});
