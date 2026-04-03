import { db } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
} from '@op/db/schema';
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

/** A legacy state-based process schema that passes the encoder's safeParse */
const legacyProcessSchema = {
  name: 'Legacy Process',
  description: 'A legacy state-based process',
  states: [
    {
      id: 'submission',
      name: 'Submission',
      type: 'initial' as const,
      config: { allowProposals: true },
    },
    {
      id: 'voting',
      name: 'Voting',
      type: 'intermediate' as const,
      config: { allowDecisions: true },
    },
    {
      id: 'completed',
      name: 'Completed',
      type: 'final' as const,
    },
  ],
  transitions: [
    {
      id: 't1',
      name: 'Start Voting',
      from: 'submission',
      to: 'voting',
      rules: { type: 'manual' as const },
    },
    {
      id: 't2',
      name: 'Complete',
      from: 'voting',
      to: 'completed',
      rules: { type: 'manual' as const },
    },
  ],
  initialState: 'submission',
  decisionDefinition: {},
  proposalTemplate: {},
};

/** Legacy instance data matching the encoder's expected shape */
const legacyInstanceData = {
  currentPhaseId: 'submission',
  phases: [
    {
      phaseId: 'submission',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

describe.concurrent('listLegacyInstances', () => {
  it('should list legacy instances for an org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    // Create org so the legacy instances have an org owner
    const organization = await testData.createOrganization(setup.userEmail);

    // Create a legacy process directly in the DB with state-based schema
    const [process] = await db
      .insert(decisionProcesses)
      .values({
        name: `Legacy Process ${task.id}`,
        description: 'A legacy process',
        processSchema: legacyProcessSchema,
        createdByProfileId: organization.profileId,
      })
      .returning();

    // Create legacy instances (no profileId — that's what makes them legacy)
    const legacyNames = ['Legacy Instance A', 'Legacy Instance B'];
    for (const name of legacyNames) {
      await db.insert(processInstances).values({
        name,
        processId: process!.id,
        ownerProfileId: organization.profileId,
        instanceData: legacyInstanceData,
        currentStateId: 'submission',
        status: ProcessStatus.PUBLISHED,
        profileId: null,
      });
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listLegacyInstances({
      ownerProfileId: organization.profileId,
    });

    expect(result).toHaveLength(2);
    result.forEach((instance) => {
      expect(instance.name).toMatch(/^Legacy Instance/);
      expect(instance.status).toBe('published');
    });
  });

  it('should include proposal and participant counts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const organization = await testData.createOrganization(setup.userEmail);

    const [process] = await db
      .insert(decisionProcesses)
      .values({
        name: `Legacy Process ${task.id}`,
        processSchema: legacyProcessSchema,
        createdByProfileId: organization.profileId,
      })
      .returning();

    await db.insert(processInstances).values({
      name: 'Legacy With Proposals',
      processId: process!.id,
      ownerProfileId: organization.profileId,
      instanceData: legacyInstanceData,
      currentStateId: 'submission',
      status: ProcessStatus.PUBLISHED,
      profileId: null,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listLegacyInstances({
      ownerProfileId: organization.profileId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.proposalCount).toBe(0);
    expect(result[0]?.participantCount).toBe(0);
  });

  it('should return empty array when no legacy instances exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const organization = await testData.createOrganization(setup.userEmail);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listLegacyInstances({
      ownerProfileId: organization.profileId,
    });

    expect(result).toHaveLength(0);
  });

  it('should filter out instances with non-legacy process schemas', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const organization = await testData.createOrganization(setup.userEmail);

    // Create a process with legacy schema
    const [legacyProcess] = await db
      .insert(decisionProcesses)
      .values({
        name: `Legacy Process ${task.id}`,
        processSchema: legacyProcessSchema,
        createdByProfileId: organization.profileId,
      })
      .returning();

    // Create a process with new phase-based schema (will fail safeParse)
    const [newProcess] = await db
      .insert(decisionProcesses)
      .values({
        name: `New Process ${task.id}`,
        processSchema: {
          id: 'new-schema',
          version: '1.0.0',
          name: 'New Schema',
          phases: [
            {
              id: 'initial',
              name: 'Initial',
              rules: { proposals: { submit: true } },
            },
          ],
        },
        createdByProfileId: organization.profileId,
      })
      .returning();

    // Create one legacy instance and one new-format instance
    await db.insert(processInstances).values([
      {
        name: 'Legacy Instance',
        processId: legacyProcess!.id,
        ownerProfileId: organization.profileId,
        instanceData: legacyInstanceData,
        currentStateId: 'submission',
        status: ProcessStatus.PUBLISHED,
        profileId: null,
      },
      {
        name: 'New Format Instance',
        processId: newProcess!.id,
        ownerProfileId: organization.profileId,
        instanceData: legacyInstanceData,
        currentStateId: 'initial',
        status: ProcessStatus.PUBLISHED,
        profileId: null,
      },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listLegacyInstances({
      ownerProfileId: organization.profileId,
    });

    // Only the legacy instance should be returned (new format is filtered out by safeParse)
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Legacy Instance');
  });

  it('should throw for users without org access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create org A with instances
    const orgA = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const organizationA = await testData.createOrganization(orgA.userEmail);

    // Create a separate org B user who has no access to org A
    const orgB = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const [process] = await db
      .insert(decisionProcesses)
      .values({
        name: `Legacy Process ${task.id}`,
        processSchema: legacyProcessSchema,
        createdByProfileId: organizationA.profileId,
      })
      .returning();

    await db.insert(processInstances).values({
      name: 'Private Legacy Instance',
      processId: process!.id,
      ownerProfileId: organizationA.profileId,
      instanceData: legacyInstanceData,
      currentStateId: 'submission',
      status: ProcessStatus.PUBLISHED,
      profileId: null,
    });

    // User from org B tries to list org A's legacy instances
    const caller = await createAuthenticatedCaller(orgB.userEmail);

    await expect(
      caller.decision.listLegacyInstances({
        ownerProfileId: organizationA.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('should include process and owner data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const organization = await testData.createOrganization(setup.userEmail);

    const [process] = await db
      .insert(decisionProcesses)
      .values({
        name: `Legacy Process ${task.id}`,
        processSchema: legacyProcessSchema,
        createdByProfileId: organization.profileId,
      })
      .returning();

    await db.insert(processInstances).values({
      name: 'Legacy With Relations',
      processId: process!.id,
      ownerProfileId: organization.profileId,
      instanceData: legacyInstanceData,
      currentStateId: 'submission',
      status: ProcessStatus.PUBLISHED,
      profileId: null,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listLegacyInstances({
      ownerProfileId: organization.profileId,
    });

    expect(result).toHaveLength(1);
    const instance = result[0]!;

    // Process should be included with the legacy schema
    expect(instance.process).toBeDefined();
    expect(instance.process?.processSchema.states).toBeDefined();
    expect(instance.process?.processSchema.transitions).toBeDefined();

    // Owner should be the org profile
    expect(instance.owner).toBeDefined();
    expect(instance.owner?.id).toBe(organization.profileId);
  });
});
