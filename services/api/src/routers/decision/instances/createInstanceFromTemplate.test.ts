import type { DecisionInstanceData } from '@op/common';
import { db, eq } from '@op/db/client';
import { decisionProcessTransitions, processInstances } from '@op/db/schema';
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

describe.concurrent('createInstanceFromTemplate', () => {
  it('should create an instance from a template with default phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create a basic setup to get an authenticated user
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromTemplate({
      templateId: 'simple',
      name: `Test Decision ${task.id}`,
      description: 'A test decision from template',
      budget: 100000,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.status).toBe('draft');

    // Verify instance data has phases
    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, result.id),
    });

    expect(instance).toBeDefined();
    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.phases).toBeDefined();
    expect(instanceData.phases.length).toBeGreaterThan(0);
    expect(instanceData.currentPhaseId).toBe('submission');
  });

  it('should create transitions for phases with date-based advancement', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Create instance with custom phase dates
    const now = new Date();
    const phase1End = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const phase2End = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const phase3End = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 days
    const phase4Start = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000); // 28 days

    const result = await caller.decision.createInstanceFromTemplate({
      templateId: 'simple',
      name: `Transition Test ${task.id}`,
      budget: 50000,
      phases: [
        {
          phaseId: 'submission',
          plannedStartDate: now.toISOString(),
          plannedEndDate: phase1End.toISOString(),
        },
        {
          phaseId: 'review',
          plannedStartDate: phase1End.toISOString(),
          plannedEndDate: phase2End.toISOString(),
        },
        {
          phaseId: 'voting',
          plannedStartDate: phase2End.toISOString(),
          plannedEndDate: phase3End.toISOString(),
        },
        {
          phaseId: 'results',
          plannedStartDate: phase4Start.toISOString(),
        },
      ],
    });

    expect(result.id).toBeDefined();

    // Verify transitions were created
    const transitions = await db.query.decisionProcessTransitions.findMany({
      where: eq(decisionProcessTransitions.processInstanceId, result.id),
      orderBy: (transitions, { asc }) => [asc(transitions.scheduledDate)],
    });

    // The simple template has 4 phases with date-based advancement
    // So we should have 3 transitions (submission→review, review→voting, voting→results)
    expect(transitions.length).toBe(3);

    // Verify transition details
    expect(transitions[0]!.fromStateId).toBe('submission');
    expect(transitions[0]!.toStateId).toBe('review');
    expect(transitions[0]!.completedAt).toBeNull();

    expect(transitions[1]!.fromStateId).toBe('review');
    expect(transitions[1]!.toStateId).toBe('voting');

    expect(transitions[2]!.fromStateId).toBe('voting');
    expect(transitions[2]!.toStateId).toBe('results');
  });

  it('should accept custom budget', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromTemplate({
      templateId: 'simple',
      name: `Budget Test ${task.id}`,
      budget: 250000,
    });

    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, result.id),
    });

    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.budget).toBe(250000);
  });

  it('should require authentication', async ({ task }) => {
    // Create an unauthenticated caller
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.createInstanceFromTemplate({
        templateId: 'simple',
        name: `Auth Test ${task.id}`,
      }),
    ).rejects.toThrow();
  });

  it('should validate name minimum length', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createInstanceFromTemplate({
        templateId: 'simple',
        name: 'AB', // Less than 3 characters
      }),
    ).rejects.toThrow();
  });

  it('should create a profile for the decision instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromTemplate({
      templateId: 'simple',
      name: `Profile Test ${task.id}`,
    });

    // Verify the instance has a profile
    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, result.id),
      with: {
        profile: true,
      },
    });

    expect(instance?.profileId).toBeDefined();
    expect(instance?.profile).toBeDefined();
    // Profile is correctly typed as EntityType.DECISION
    const profile = instance?.profile as { type: string } | undefined;
    expect(profile?.type).toBe('decision');
  });
});
