import { db, eq } from '@op/db/client';
import {
  ProposalStatus,
  decisionProcessResults,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  proposals,
} from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

/**
 * Directly inserts a vote submission + vote proposals join rows for a given
 * voter. Bypasses the voting business logic so these tests stay focused on
 * the ballot-visibility filter in listProposals.
 */
async function seedBallot({
  processInstanceId,
  voterProfileId,
  proposalIds,
}: {
  processInstanceId: string;
  voterProfileId: string;
  proposalIds: string[];
}) {
  const [submission] = await db
    .insert(decisionsVoteSubmissions)
    .values({
      processInstanceId,
      submittedByProfileId: voterProfileId,
      voteData: {
        schemaVersion: '1.0.0',
        schemaType: 'simple',
        submissionMetadata: { timestamp: new Date().toISOString() },
        validationSignature: 'test-signature',
      },
    })
    .returning({ id: decisionsVoteSubmissions.id });

  if (!submission) {
    throw new Error('Failed to seed vote submission');
  }

  if (proposalIds.length > 0) {
    await db.insert(decisionsVoteProposals).values(
      proposalIds.map((proposalId) => ({
        voteSubmissionId: submission.id,
        proposalId,
      })),
    );
  }

  return submission;
}

describe.concurrent('listProposals: votedByProfileId (ballot filter)', () => {
  it('returns only the proposals a voter voted on when they query their own ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Create a voter and a submitter; the submitter contributes 3 proposals,
    // the voter votes on 2 of them.
    const [voter, submitter] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const submitterCaller = await createAuthenticatedCaller(submitter.email);

    const proposalA = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Proposal A ${task.id}` },
    });
    const proposalB = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Proposal B ${task.id}` },
    });
    const proposalC = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Proposal C ${task.id}` },
    });

    await Promise.all([
      submitterCaller.decision.submitProposal({ proposalId: proposalA.id }),
      submitterCaller.decision.submitProposal({ proposalId: proposalB.id }),
      submitterCaller.decision.submitProposal({ proposalId: proposalC.id }),
    ]);

    await seedBallot({
      processInstanceId: instance.instance.id,
      voterProfileId: voter.profileId,
      proposalIds: [proposalA.id, proposalC.id],
    });

    const voterCaller = await createAuthenticatedCaller(voter.email);
    const result = await voterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
    });

    const returnedIds = result.proposals.map((p) => p.id).sort();
    expect(returnedIds).toEqual([proposalA.id, proposalC.id].sort());
    expect(result.total).toBe(2);
  });

  it("rejects another member trying to view a voter's ballot", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [voter, snoop] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const voterCaller = await createAuthenticatedCaller(voter.email);
    const proposal = await testData.createProposal({
      userEmail: voter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Ballot Target ${task.id}` },
    });
    await voterCaller.decision.submitProposal({ proposalId: proposal.id });

    await seedBallot({
      processInstanceId: instance.instance.id,
      voterProfileId: voter.profileId,
      proposalIds: [proposal.id],
    });

    const snoopCaller = await createAuthenticatedCaller(snoop.email);
    await expect(
      snoopCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
        votedByProfileId: voter.profileId,
      }),
    ).rejects.toThrowError(TRPCError);
  });

  it("does not leak the voter's own drafts into ballot results", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const voter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const voterCaller = await createAuthenticatedCaller(voter.email);

    // Voter creates one submitted proposal (which will be on the ballot) and
    // one draft proposal (which must NOT appear in ballot results).
    const submittedProposal = await testData.createProposal({
      userEmail: voter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Submitted ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    const draftProposal = await testData.createProposal({
      userEmail: voter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Draft (must not leak) ${task.id}` },
    });

    await seedBallot({
      processInstanceId: instance.instance.id,
      voterProfileId: voter.profileId,
      proposalIds: [submittedProposal.id],
    });

    const result = await voterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
    });

    const ids = result.proposals.map((p) => p.id);
    expect(ids).toContain(submittedProposal.id);
    expect(ids).not.toContain(draftProposal.id);
    expect(result.total).toBe(1);
  });

  it('excludes a soft-deleted proposal from ballot results', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const voter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const voterCaller = await createAuthenticatedCaller(voter.email);

    const [keptProposal, deletedProposal] = await Promise.all([
      testData.createProposal({
        userEmail: voter.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Kept ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: voter.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Deleted after vote ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await seedBallot({
      processInstanceId: instance.instance.id,
      voterProfileId: voter.profileId,
      proposalIds: [keptProposal.id, deletedProposal.id],
    });

    // Soft-delete one voted-on proposal after the ballot was cast.
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, deletedProposal.id));

    const result = await voterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
    });

    const ids = result.proposals.map((p) => p.id);
    expect(ids).toContain(keptProposal.id);
    expect(ids).not.toContain(deletedProposal.id);
    expect(result.total).toBe(1);
  });

  it('returns accurate voteCount per proposal on a ballot query', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [voter, otherVoter, submitter] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const submitterCaller = await createAuthenticatedCaller(submitter.email);

    const proposalA = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Vote Count A ${task.id}` },
    });
    const proposalB = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Vote Count B ${task.id}` },
    });

    await Promise.all([
      submitterCaller.decision.submitProposal({ proposalId: proposalA.id }),
      submitterCaller.decision.submitProposal({ proposalId: proposalB.id }),
    ]);

    // Voter votes on both proposals; otherVoter votes only on proposalA.
    await Promise.all([
      seedBallot({
        processInstanceId: instance.instance.id,
        voterProfileId: voter.profileId,
        proposalIds: [proposalA.id, proposalB.id],
      }),
      seedBallot({
        processInstanceId: instance.instance.id,
        voterProfileId: otherVoter.profileId,
        proposalIds: [proposalA.id],
      }),
    ]);

    const voterCaller = await createAuthenticatedCaller(voter.email);

    // Without a published results record, voteCount must be null — prevents
    // live tally exposure during voting.
    const resultBeforePublish = await voterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
    });
    const byIdBefore = Object.fromEntries(
      resultBeforePublish.proposals.map((p) => [p.id, p]),
    );
    expect(byIdBefore[proposalA.id]?.voteCount).toBeNull();
    expect(byIdBefore[proposalB.id]?.voteCount).toBeNull();

    // Seed a published results record (simulates the pipeline completing).
    await db.insert(decisionProcessResults).values({
      processInstanceId: instance.instance.id,
      success: true,
      selectedCount: 2,
      voterCount: 2,
    });

    // After publication, accurate counts are returned.
    const resultAfterPublish = await voterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
    });
    const byIdAfter = Object.fromEntries(
      resultAfterPublish.proposals.map((p) => [p.id, p]),
    );
    // proposalA was voted on by both voters (count = 2)
    expect(byIdAfter[proposalA.id]?.voteCount).toBe(2);
    // proposalB was voted on by voter only (count = 1)
    expect(byIdAfter[proposalB.id]?.voteCount).toBe(1);
  });

  it('rejects a decision admin trying to view another user’s ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const voter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const voterCaller = await createAuthenticatedCaller(voter.email);
    const proposal = await testData.createProposal({
      userEmail: voter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Admin Peek ${task.id}` },
    });
    await voterCaller.decision.submitProposal({ proposalId: proposal.id });

    await seedBallot({
      processInstanceId: instance.instance.id,
      voterProfileId: voter.profileId,
      proposalIds: [proposal.id],
    });

    // setup.userEmail is a decision admin on the instance's profile.
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await expect(
      adminCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
        votedByProfileId: voter.profileId,
      }),
    ).rejects.toThrowError(TRPCError);
  });
});
