import { RejectionReason } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAuthenticatedCaller } from '../../../test/supabase-utils';

describe.concurrent('rejectProposal', () => {
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
    const [proposal, authorCaller] = await Promise.all([
      testData.createProposal({
        userEmail: author.email,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Author Proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
      createAuthenticatedCaller(author.email),
    ]);

    await expect(
      authorCaller.decision.rejectProposal({
        proposalId: proposal.id,
        reason: RejectionReason.INELIGIBLE,
      }),
    ).rejects.toMatchObject({ cause: { statusCode: 403 } });

    const row = await db.query.proposals.findFirst({
      where: { id: proposal.id },
      columns: { status: true },
    });
    expect(row?.status).toBe(ProposalStatus.SUBMITTED);
  });
});
