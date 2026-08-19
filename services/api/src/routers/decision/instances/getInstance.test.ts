import { createDecisionRole } from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

describe.concurrent('getInstance', () => {
  it('should return admin access without review for a profile admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // grantAccess: true uses isAdmin=true which assigns the Admin role (profile.ADMIN)
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.access?.admin).toBe(true);
    expect(result.access?.submitProposals).toBe(true);
    expect(result.access?.vote).toBe(true);
    // Administering a process does not make you one of its reviewers: neither
    // the seeded decision Admin role nor the profile-admin bypass grants
    // REVIEW. Admin-only gates (progress, aggregates) check `admin`.
    expect(result.access?.review).toBe(false);
  });

  it('should keep review for a profile admin who also holds a REVIEW role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const reviewerRole = await createDecisionRole({
      name: 'Reviewer',
      profileId: instance.profileId,
      permissions: {
        decisions: {
          type: 'decision',
          value: {
            create: false,
            read: true,
            update: false,
            delete: false,
            admin: false,
            inviteMembers: false,
            review: true,
            submitProposals: false,
            vote: false,
          },
        },
      },
    });
    await testData.assignRole(
      setup.user.id,
      instance.profileId,
      reviewerRole.id,
    );

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    // The profile-admin bypass must not swallow a REVIEW grant the admin
    // genuinely holds — that is how a process makes its admins reviewers.
    expect(result.access?.admin).toBe(true);
    expect(result.access?.review).toBe(true);
  });

  it('should return limited access for a member (non-admin) user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const instance = setup.instance;

    // Member role has decisions.SUBMIT_PROPOSALS and decisions.VOTE but not admin
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const caller = await createAuthenticatedCaller(member.email);
    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.access?.admin).toBe(false);
    expect(result.access?.submitProposals).toBe(true);
    expect(result.access?.vote).toBe(true);
  });

  it('should grant submit access to a no-JWT visitor on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Make the decision public per the runbook: GLOBAL_USER_PUBLIC holds a
    // Public role with a profile-scoped decisions READ+SUBMIT+VOTE override.
    await testData.makeDecisionPublic(instance.profileId);

    // No-JWT caller — substituted to GLOBAL_USER_PUBLIC by the access layer.
    const publicCaller = createCaller(await createTestContextWithSession(null));
    const result = await publicCaller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    // The access object reflects the public role's grant — this is what gates
    // anonymous sign-in in useCreateProposal.
    expect(result.access).toMatchObject({
      submitProposals: true,
      vote: true,
      admin: false,
    });
  });

  it('should deny a no-JWT visitor on a non-public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // No make-public grant: GLOBAL_USER_PUBLIC has no access to this profile,
    // so a no-JWT visitor is denied (no submit access is ever surfaced).
    const publicCaller = createCaller(await createTestContextWithSession(null));

    await expect(
      publicCaller.decision.getInstance({
        instanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
    });
  });

  it('should return NOT_FOUND for a non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getInstance({
        instanceId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { statusCode: 404 } });
  });

  it('should return FORBIDDEN for a user with no access to the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const instance = setup.instance;

    // Create a user in a completely separate org — org-level fallback would grant READ
    // to members of the same org, so we must use a different org to test true unauthorized access
    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.decision.getInstance({
        instanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { statusCode: 403 } });
  });

  it('should exclude draft proposals from stats', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const draftProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Draft proposal',
        description: 'Still drafting',
      },
    });

    const submittedProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Submitted proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const submittedResult = await caller.decision.submitProposal({
      proposalId: submittedProposal.id,
    });

    expect(draftProposal.status).toBe(ProposalStatus.DRAFT);
    expect(submittedResult.status).toBe(ProposalStatus.SUBMITTED);

    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.proposalCount).toBe(1);
    expect(result.participantCount).toBe(1);
  });
});

describeDecisionAccessTierGating('getInstance', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.getInstance({ instanceId: instance.instance.id }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.getInstance({ instanceId: instance.instance.id }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.getInstance({ instanceId: instance.instance.id }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.getInstance({ instanceId: instance.instance.id }),
      );
    },
  ),
});

describeDecisionAccessTierGating('getLegacyInstance', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getLegacyInstance({ instanceId: instance.instance.id }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getLegacyInstance({ instanceId: instance.instance.id }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getLegacyInstance({ instanceId: instance.instance.id }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      // getLegacyInstance is @deprecated and its legacy output encoder only
      // accepts the pre-v2 processSchema shape. createDecisionSetup builds
      // v2 schemas, so output validation fails — but the call passes the
      // gate, which is what this matrix asserts.
      let caught: unknown;
      try {
        await caller.decision.getLegacyInstance({
          instanceId: instance.instance.id,
        });
      } catch (err) {
        caught = err;
      }
      expect((caught as { cause?: { name?: string } })?.cause?.name).not.toBe(
        'UnauthorizedError',
      );
    },
  ),
});
