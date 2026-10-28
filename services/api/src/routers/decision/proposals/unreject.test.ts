import { RejectionReason } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAuthenticatedCaller } from '../../../test/supabase-utils';

describe.concurrent('unrejectProposal', () => {
  it('lets a profile admin without Manage Process restore a rejected proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const profileAdmin = await testData.createProfileAdminUser({
      organization: setup.organization,
      instanceProfileId: setup.instance.profileId,
    });
    const [proposal, adminCaller, profileAdminCaller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
      createAuthenticatedCaller(setup.userEmail),
      createAuthenticatedCaller(profileAdmin.email),
    ]);
    await adminCaller.decision.rejectProposal({
      proposalId: proposal.id,
      reason: RejectionReason.INELIGIBLE,
    });

    await profileAdminCaller.decision.unrejectProposal({
      proposalId: proposal.id,
    });

    const row = await db.query.proposals.findFirst({
      where: { id: proposal.id },
      columns: { status: true },
    });
    expect(row?.status).toBe(ProposalStatus.SUBMITTED);
  });

  it("rejects the proposal's author, who is admin of the proposal but not the decision", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const [proposal, adminCaller, authorCaller] = await Promise.all([
      testData.createProposal({
        userEmail: author.email,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Author Proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
      createAuthenticatedCaller(setup.userEmail),
      createAuthenticatedCaller(author.email),
    ]);
    await adminCaller.decision.rejectProposal({
      proposalId: proposal.id,
      reason: RejectionReason.INELIGIBLE,
    });

    await expect(
      authorCaller.decision.unrejectProposal({ proposalId: proposal.id }),
    ).rejects.toMatchObject({ cause: { statusCode: 403 } });

    const row = await db.query.proposals.findFirst({
      where: { id: proposal.id },
      columns: { status: true },
    });
    expect(row?.status).toBe(ProposalStatus.REJECTED);
  });
});
