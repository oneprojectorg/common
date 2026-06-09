import { db } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
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

describe.concurrent('getLatestSelectionForProposal', () => {
  it('returns null when no result run has executed on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Unranked' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    expect(result).toBeNull();
  });

  it('returns null when the latest result failed, even if the proposal was in an earlier successful run', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Eligible' },
    });

    // Earlier successful run with the proposal selected.
    const earlier = new Date(Date.now() - 60_000).toISOString();
    const [earlierResult] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
        voterCount: 1,
        executedAt: earlier,
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: earlierResult!.id,
      proposalId: proposal.id,
      allocated: '1000',
      selectionRank: 1,
    });

    // Most recent run failed.
    await db.insert(decisionProcessResults).values({
      processInstanceId: instance.id,
      success: false,
      errorMessage: 'pipeline boom',
      executedAt: new Date().toISOString(),
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    // The router checks the *latest* row only — a failure shadows older
    // successes and returns null until a fresh run is recorded.
    expect(result).toBeNull();
  });

  it('returns null when the proposal was not picked by the latest successful run', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const [picked, skipped] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.id,
        proposalData: { title: 'Picked' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.id,
        proposalData: { title: 'Skipped' },
      }),
    ]);

    const [resultRow] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
        voterCount: 3,
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: resultRow!.id,
      proposalId: picked.id,
      allocated: '500',
      selectionRank: 1,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: skipped.id,
    });

    expect(result).toBeNull();
  });

  it('returns allocated + selectionRank from the latest successful result', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Funded' },
    });

    const [resultRow] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
        voterCount: 4,
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: resultRow!.id,
      proposalId: proposal.id,
      allocated: '1234.56',
      selectionRank: 2,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    expect(result).toEqual({
      proposalId: proposal.id,
      allocated: '1234.56',
      selectionRank: 2,
    });
  });

  it('returns null fields when the selection row has null allocated and null rank', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Picked without allocation' },
    });

    const [resultRow] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
      })
      .returning();

    // submitManualSelection writes selections without an allocated amount when
    // the admin hasn't entered one — the router must still surface the row.
    await db.insert(decisionProcessResultSelections).values({
      processResultId: resultRow!.id,
      proposalId: proposal.id,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    expect(result).toEqual({
      proposalId: proposal.id,
      allocated: null,
      selectionRank: null,
    });
  });

  it('uses the most recent run when multiple successful runs exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Reallocated' },
    });

    // Earlier successful run picked the proposal at $1,000.
    const [earlierResult] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
        executedAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: earlierResult!.id,
      proposalId: proposal.id,
      allocated: '1000',
      selectionRank: 5,
    });

    // Later successful run picked the same proposal at $2,500 — this is the
    // one the API should return.
    const [latestResult] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
        executedAt: new Date().toISOString(),
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: latestResult!.id,
      proposalId: proposal.id,
      allocated: '2500',
      selectionRank: 1,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    expect(result).toEqual({
      proposalId: proposal.id,
      allocated: '2500',
      selectionRank: 1,
    });
  });

  it('returns null when the proposal was dropped between runs (in earlier run only)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const [keeper, dropped] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.id,
        proposalData: { title: 'Keeper' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.id,
        proposalData: { title: 'Dropped' },
      }),
    ]);

    // First run picks both proposals.
    const [firstRun] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 2,
        executedAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values([
      {
        processResultId: firstRun!.id,
        proposalId: keeper.id,
        allocated: '100',
        selectionRank: 1,
      },
      {
        processResultId: firstRun!.id,
        proposalId: dropped.id,
        allocated: '200',
        selectionRank: 2,
      },
    ]);

    // Second run keeps only the first proposal.
    const [secondRun] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
        executedAt: new Date().toISOString(),
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: secondRun!.id,
      proposalId: keeper.id,
      allocated: '300',
      selectionRank: 1,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [keeperSelection, droppedSelection] = await Promise.all([
      caller.decision.getLatestSelectionForProposal({ proposalId: keeper.id }),
      caller.decision.getLatestSelectionForProposal({ proposalId: dropped.id }),
    ]);

    expect(keeperSelection).toEqual({
      proposalId: keeper.id,
      allocated: '300',
      selectionRank: 1,
    });
    expect(droppedSelection).toBeNull();
  });

  it('throws NotFoundError for a non-existent proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getLatestSelectionForProposal({
        proposalId: randomUUID(),
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('throws UnauthorizedError when the caller is in a different organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Private to setup org' },
    });

    // Outsider belongs to a different organization and has no profile access
    // on the instance.
    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsiderCaller = await createAuthenticatedCaller(
      outsiderSetup.userEmail,
    );

    await expect(
      outsiderCaller.decision.getLatestSelectionForProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('allows an org member without profile access via the org-level fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Visible to org members' },
    });

    const [resultRow] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: resultRow!.id,
      proposalId: proposal.id,
      allocated: '750',
      selectionRank: 1,
    });

    // Plain org member with no profile-level access — relies on the org-level
    // decisions: READ fallback in assertInstanceProfileAccess.
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const caller = await createAuthenticatedCaller(member.email);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    expect(result).toEqual({
      proposalId: proposal.id,
      allocated: '750',
      selectionRank: 1,
    });
  });

  it('allows a user with profile access who is not in the organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance, profileId } = setup.instances[0]!;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Shared with external reviewer' },
    });

    const [resultRow] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        selectedCount: 1,
      })
      .returning();

    await db.insert(decisionProcessResultSelections).values({
      processResultId: resultRow!.id,
      proposalId: proposal.id,
      allocated: '420',
      selectionRank: 1,
    });

    // External user belongs to a different org — grant them profile-level
    // READ on the instance profile to exercise the profile-permission branch.
    const externalSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    await testData.grantProfileAccess(
      profileId,
      externalSetup.user.id,
      externalSetup.userEmail,
      false,
    );

    const caller = await createAuthenticatedCaller(externalSetup.userEmail);

    const result = await caller.decision.getLatestSelectionForProposal({
      proposalId: proposal.id,
    });

    expect(result).toEqual({
      proposalId: proposal.id,
      allocated: '420',
      selectionRank: 1,
    });
  });
});

describeDecisionAccessTierGating('getLatestSelectionForProposal', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
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
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'gating' },
      });

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.getLatestSelectionForProposal({
          proposalId: proposal.id,
        }),
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
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'gating' },
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.getLatestSelectionForProposal({
          proposalId: proposal.id,
        }),
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
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'gating' },
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.getLatestSelectionForProposal({
          proposalId: proposal.id,
        }),
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
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'gating' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.getLatestSelectionForProposal({
          proposalId: proposal.id,
        }),
      );
    },
  ),
});
