import { db } from '@op/db/client';
import { ProposalStatus, Visibility, proposals } from '@op/db/schema';
import { eq } from 'drizzle-orm';
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

describe.concurrent('listProposalLocations', () => {
  it('returns every located proposal and drops those without coordinates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [located1, located2, unlocated, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Located One' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Located Two' },
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
      setLocation(located1.id, { lat: 40.7, lng: -74 }),
      setLocation(located2.id, { lat: 34, lng: -118.2 }),
      setLocation(unlocated.id, null),
    ]);

    const result = await caller.decision.listProposalLocations({
      processInstanceId: instanceId,
    });

    const ids = result.proposals.map((p) => p.id).sort();
    expect(ids).toEqual([located1.id, located2.id].sort());
    // The pin needs coordinates + author, so both must survive the slim map.
    const first = result.proposals.find((p) => p.id === located1.id);
    expect(first?.proposalData.location).toEqual({ lat: 40.7, lng: -74 });
    expect(first?.submittedBy).toBeDefined();
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
    const result = await memberCaller.decision.listProposalLocations({
      processInstanceId: instanceId,
    });

    // The hidden proposal has coordinates but must not leak a pin to a member
    // who can't see it in the list.
    expect(result.proposals.map((p) => p.id)).toEqual([visible.id]);
  });

  it('applies the search filter so pins match the list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [matching, other, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Riverside Bike Path' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Downtown Mural' },
        status: ProposalStatus.SUBMITTED,
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    await Promise.all([
      setLocation(matching.id, { lat: 40.7, lng: -74 }),
      setLocation(other.id, { lat: 34, lng: -118.2 }),
    ]);

    const result = await caller.decision.listProposalLocations({
      processInstanceId: instanceId,
      search: 'bike',
    });

    expect(result.proposals.map((p) => p.id)).toEqual([matching.id]);
  });
});

describeDecisionAccessTierGating('listProposalLocations', {
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
        caller.decision.listProposalLocations({
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
        caller.decision.listProposalLocations({
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
        caller.decision.listProposalLocations({
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
        caller.decision.listProposalLocations({
          processInstanceId: setup.instance.instance.id,
        }),
      );
    },
  ),
});
