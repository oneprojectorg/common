import { getInstancePhases } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  EntityType,
  processInstances,
  profileInvites,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import { createGatingCallers } from '../../../test/helpers/gating/callers';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/** Matches TIPTAP_SECRET in services/api/vitest.config.ts. */
const TIPTAP_SECRET = 'test-tiptap-secret';

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Moves the instance onto its final phase, where editing is closed. */
async function moveToLastPhase(processInstanceId: string): Promise<void> {
  const instanceRecord = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
  });

  if (!instanceRecord) {
    throw new Error(`Instance ${processInstanceId} not found`);
  }

  const phases = getInstancePhases(instanceRecord.instanceData);
  const lastPhase = phases[phases.length - 1];

  if (!lastPhase) {
    throw new Error(`Instance ${processInstanceId} has no phases`);
  }

  await db
    .update(processInstances)
    .set({ currentStateId: lastPhase.phaseId })
    .where(eq(processInstances.id, processInstanceId));
}

function storedCollaborationDocId(proposalData: unknown): string | undefined {
  return (proposalData as { collaborationDocId?: string }).collaborationDocId;
}

function decodeCollabToken(token: string): {
  sub?: string;
  allowedDocumentNames?: unknown;
} {
  const payload = jwt.verify(token, TIPTAP_SECRET, { algorithms: ['HS256'] });

  if (typeof payload === 'string') {
    throw new Error('Expected a decoded JWT payload, got a string');
  }

  return payload;
}

describe.concurrent('decision.getCollabToken', () => {
  it('issues a document-scoped token to the proposal author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId?: string;
    };

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const { token } = await caller.decision.getCollabToken({
      proposalProfileId: proposal.profileId,
    });

    const payload = decodeCollabToken(token);

    expect(payload.sub).toBe(setup.user.id);
    expect(payload.allowedDocumentNames).toEqual([collaborationDocId]);
  });

  it('issues a token to an invited collaborator on the proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const invitee = await profileData.createStandaloneUser();

    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: proposal.profileId,
      profileEntityType: EntityType.PROPOSAL,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: setup.organization.profileId,
    });

    profileData.trackProfileInvite(invitee.email, proposal.profileId);

    const caller = await createAuthenticatedCaller(invitee.email);
    await caller.decision.acceptProposalInvite({
      profileId: proposal.profileId,
    });

    const { token } = await caller.decision.getCollabToken({
      proposalProfileId: proposal.profileId,
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId?: string;
    };

    const payload = decodeCollabToken(token);

    expect(payload.sub).toBe(invitee.authUserId);
    expect(payload.allowedDocumentNames).toEqual([collaborationDocId]);
  });

  // Today's gate admits any process Member holding `decisions: UPDATE`, which
  // is wider than the proposal's own collaborators. #1879 narrows it; this
  // asserts the rule as it stands so the tightening is visible as a diff.
  it('issues a token to a process member who is not on the proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    const caller = await createAuthenticatedCaller(member.email);
    const { token } = await caller.decision.getCollabToken({
      proposalProfileId: proposal.profileId,
    });

    expect(decodeCollabToken(token).sub).toBe(member.authUserId);
  });

  it('refuses an authenticated user with no standing on the process', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const outsider = await profileData.createStandaloneUser();
    const caller = await createAuthenticatedCaller(outsider.email);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('404s an unknown proposal profile id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a proposal that has no collaboration document', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    // A `description` makes the helper write legacy proposalData with no
    // collaborationDocId.
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Legacy Proposal', description: 'No collab doc' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('ignores a client-supplied collaborationDocId when minting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Mine' },
    });

    const otherProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Theirs' },
    });

    const ownDocId = storedCollaborationDocId(proposal.proposalData);
    const otherDocId = storedCollaborationDocId(otherProposal.proposalData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Point the proposal at another proposal's document, then at everything.
    for (const injected of [otherDocId, '*']) {
      await caller.decision.updateProposal({
        proposalId: proposal.id,
        data: {
          proposalData: { title: 'Mine', collaborationDocId: injected },
        },
      });

      const stored = await db.query.proposals.findFirst({
        where: { id: proposal.id },
        columns: { proposalData: true },
      });

      expect(storedCollaborationDocId(stored?.proposalData)).toBe(ownDocId);

      const { token } = await caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      });

      expect(decodeCollabToken(token).allowedDocumentNames).toEqual([ownDocId]);
    }
  });

  it('refuses a token once the instance reaches its final phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    await moveToLastPhase(setup.instance.instance.id);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('404s a moderation-detached proposal, even for its author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('refuses an anonymous caller on a real proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const anonCaller = await createGatingCallers(onTestFinished).anonJwt();

    await expect(
      anonCaller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

// `authenticatedProcedure`: only a caller with no session is turned away by
// the tier gate; every signed-in tier reaches the service-layer gate.
describeAccessTierGating('decision.getCollabToken', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.getCollabToken({
        proposalProfileId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.decision.getCollabToken({
          proposalProfileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.getCollabToken({
          proposalProfileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.getCollabToken({
          proposalProfileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});
