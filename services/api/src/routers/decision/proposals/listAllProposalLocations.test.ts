import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  proposals,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { schemaMissingPipeline } from '../../../test/helpers/pipelineSchemas';
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

// The helper's proposalData type is intentionally narrow, so the pin location
// is written straight to the row — the only field these tests care about.
async function setLocation(
  proposalId: string,
  location: { lat: number; lng: number } | null,
) {
  await db
    .update(proposals)
    .set({ proposalData: { title: 'Located Proposal', location } })
    .where(eq(proposals.id, proposalId));
}

describe.concurrent('listAllProposalLocations', () => {
  it('pins every located proposal across phases, uncapped by list pagination', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Pass-none pipeline: the submission-phase proposal is NOT carried into
    // review, so it drops out of the phase-scoped scope after the advance.
    const setup = await testData.createDecisionSetup({
      processSchema: schemaMissingPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const submissionProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'From submission' },
      status: ProposalStatus.SUBMITTED,
    });
    await setLocation(submissionProposal.id, { lat: 40.7, lng: -74 });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const reviewProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'From review' },
      status: ProposalStatus.SUBMITTED,
    });
    await setLocation(reviewProposal.id, { lat: 34, lng: -118.2 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [locations, firstPage] = await Promise.all([
      caller.decision.listAllProposalLocations({
        processInstanceId: instanceId,
      }),
      // The results list this map sits beside pages one proposal at a time.
      caller.decision.listAllProposals({
        processInstanceId: instanceId,
        limit: 1,
      }),
    ]);

    // Pins cover both phases and both pages; the list only has the first page.
    expect(locations.proposals.map((p) => p.id).sort()).toEqual(
      [submissionProposal.id, reviewProposal.id].sort(),
    );
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.total).toBe(2);
  });

  it('drops proposals without coordinates and keeps the pin author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [located, unlocated, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Located' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'No Location' },
        status: ProposalStatus.SUBMITTED,
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    await Promise.all([
      setLocation(located.id, { lat: 40.7, lng: -74 }),
      setLocation(unlocated.id, null),
    ]);

    const result = await caller.decision.listAllProposalLocations({
      processInstanceId: instanceId,
    });

    expect(result.proposals.map((p) => p.id)).toEqual([located.id]);
    // The pin needs coordinates + author, so both must survive the slim map.
    expect(result.proposals[0]?.proposalData.location).toEqual({
      lat: 40.7,
      lng: -74,
    });
    expect(result.proposals[0]?.submittedBy).toBeDefined();
  });

  it('does not surface a hidden proposal to a non-admin member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [visible, hidden, member] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Visible' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Hidden' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [setup.instance.profileId],
      }),
    ]);

    await Promise.all([
      setLocation(visible.id, { lat: 40.7, lng: -74 }),
      // Location + visibility in one update — the proposal-history trigger
      // rejects two concurrent writes to the same row.
      db
        .update(proposals)
        .set({
          proposalData: { title: 'Hidden', location: { lat: 41, lng: -73 } },
          visibility: Visibility.HIDDEN,
        })
        .where(eq(proposals.id, hidden.id)),
    ]);

    const memberCaller = await createAuthenticatedCaller(member.email);
    const result = await memberCaller.decision.listAllProposalLocations({
      processInstanceId: instanceId,
    });

    // The hidden proposal has coordinates but must not leak a pin to a member
    // who can't see it in the results list.
    expect(result.proposals.map((p) => p.id)).toEqual([visible.id]);
  });
});

describeDecisionAccessTierGating('listAllProposalLocations', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.listAllProposalLocations({
          processInstanceId: setup.instance.instance.id,
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

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.listAllProposalLocations({
          processInstanceId: setup.instance.instance.id,
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

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.listAllProposalLocations({
          processInstanceId: setup.instance.instance.id,
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

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.listAllProposalLocations({
          processInstanceId: setup.instance.instance.id,
        }),
      );
    },
  ),
});
