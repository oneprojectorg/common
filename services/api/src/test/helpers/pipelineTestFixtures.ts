import {
  type DecisionInstanceData,
  advancePhase,
  simpleVoting,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
  users,
} from '@op/db/schema';

import { appRouter } from '../../routers';
import { createCallerFactory } from '../../trpcFactory';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../supabase-utils';
import type { TestDecisionsDataManager } from './TestDecisionsDataManager';

const createCaller = createCallerFactory(appRouter);

export async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Creates a proposal and immediately submits it.
 * Submitted proposals have a history record (created by the DB trigger on status change),
 * which is required for the transition join table.
 */
export async function createAndSubmitProposal(
  testData: TestDecisionsDataManager,
  caller: Awaited<ReturnType<typeof createAuthenticatedCaller>>,
  options: {
    userEmail: string;
    processInstanceId: string;
    proposalData: { title: string };
  },
) {
  const proposal = await testData.createProposal(options);
  await caller.decision.submitProposal({ proposalId: proposal.id });
  return proposal;
}

/**
 * Process schema with a limit(2) selectionPipeline on the departing 'submission' phase.
 * Used to test that transitions persist only surviving proposals.
 */
export const schemaWithPipeline = {
  name: 'Pipeline Process',
  states: [
    { id: 'submission', name: 'Submission', type: 'initial' },
    { id: 'review', name: 'Review', type: 'final' },
  ],
  transitions: [
    {
      id: 'submission-to-review',
      name: 'Submit to Review',
      from: 'submission',
      to: 'review',
      rules: { type: 'manual' },
    },
  ],
  initialState: 'submission',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-block', type: 'limit', count: 2 }],
      },
    },
    { id: 'review', name: 'Review', rules: {} },
  ],
};

/**
 * Three-phase schema with a limiting selectionPipeline on each of the first two phases.
 * submission → review (limit 3), review → final (limit 2).
 * Used to test multi-transition chaining: proposals must survive both pipelines.
 */
export const schemaWithThreePhasesAndPipelines = {
  name: 'Three Phase Pipeline Process',
  states: [
    { id: 'submission', name: 'Submission', type: 'initial' },
    { id: 'review', name: 'Review', type: 'intermediate' },
    { id: 'final', name: 'Final', type: 'final' },
  ],
  transitions: [
    {
      id: 'submission-to-review',
      name: 'Submit to Review',
      from: 'submission',
      to: 'review',
      rules: { type: 'manual' },
    },
    {
      id: 'review-to-final',
      name: 'Review to Final',
      from: 'review',
      to: 'final',
      rules: { type: 'manual' },
    },
  ],
  initialState: 'submission',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-1', type: 'limit', count: 3 }],
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-2', type: 'limit', count: 2 }],
      },
    },
    { id: 'final', name: 'Final', rules: {} },
  ],
};

/**
 * Same schema without any selectionPipeline — all proposals survive the transition.
 */
export const schemaWithoutPipeline = {
  ...schemaWithPipeline,
  phases: [
    { id: 'submission', name: 'Submission', rules: {} },
    { id: 'review', name: 'Review', rules: {} },
  ],
};

/**
 * Creates a process instance configured with the given processSchema,
 * starting in the 'submission' phase.
 */
export async function createInstanceWithSchema(
  testData: TestDecisionsDataManager,
  taskId: string,
  processSchema: Record<string, unknown>,
) {
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, setup.userEmail));

  if (!userRecord?.profileId) {
    throw new Error('Test user must have a profileId');
  }

  const [process] = await db
    .insert(decisionProcesses)
    .values({
      name: `Pipeline Process ${taskId}`,
      description: 'Test process for pipeline execution',
      processSchema,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  const caller = await createAuthenticatedCaller(setup.userEmail);

  const [simpleTemplate] = await db
    .insert(decisionProcesses)
    .values({
      name: `Simple Template ${taskId}`,
      description: simpleVoting.description,
      processSchema: simpleVoting,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  const instanceResult = await caller.decision.createInstanceFromTemplate({
    templateId: simpleTemplate!.id,
    name: `Pipeline Test ${taskId}`,
  });

  testData.trackProfileForCleanup(instanceResult.id);

  const instanceId = instanceResult.processInstance.id;

  // Build instanceData.phases from the processSchema.phases, copying
  // selectionPipeline so advancePhase can resolve it from instance data.
  const schemaPhases =
    (processSchema as { phases?: Array<Record<string, unknown>> }).phases ?? [];
  const instancePhases = schemaPhases.map((p) => ({
    phaseId: p.id as string,
    name: p.name as string,
    ...(p.selectionPipeline ? { selectionPipeline: p.selectionPipeline } : {}),
  }));

  await db
    .update(processInstances)
    .set({
      processId: process!.id,
      currentStateId: 'submission',
      status: ProcessStatus.PUBLISHED,
      instanceData: {
        currentPhaseId: 'submission',
        phases: instancePhases,
      },
    })
    .where(eq(processInstances.id, instanceId));

  return {
    instanceId,
    user: setup.user,
    userEmail: setup.userEmail,
    caller,
    testData,
  };
}

/**
 * Test helper that wraps advancePhase with a simpler interface.
 * Loads the instance, then advances from `fromPhaseId` to `toPhaseId`.
 */
export async function executeTestTransition(opts: {
  instanceId: string;
  fromPhaseId: string;
  toPhaseId: string;
}) {
  const processInstance = await db.query.processInstances.findFirst({
    where: { id: opts.instanceId },
  });
  if (!processInstance) {
    throw new Error(`Instance ${opts.instanceId} not found`);
  }
  return db.transaction(async (tx) =>
    advancePhase({
      tx,
      instance: {
        ...processInstance,
        instanceData: processInstance.instanceData as DecisionInstanceData,
      },
      fromPhaseId: opts.fromPhaseId,
      toPhaseId: opts.toPhaseId,
      triggeredByProfileId: null,
    }),
  );
}
