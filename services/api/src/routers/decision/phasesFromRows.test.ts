import {
  type DecisionSchemaDefinition,
  onPhaseAdvanced,
  processDecisionsTransitions,
} from '@op/common';
import {
  TestDecisionsDataManager,
  updateInstancePhases,
} from '@op/common/testing';
import { and, db, eq, isNull, sql } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
  processPhases,
} from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

import { createAuthenticatedCaller } from '../../test/supabase-utils';

const passAll = { version: '1.0.0' as const, blocks: [] };

const threeStepDateSchema = {
  id: 'rows-three-step',
  version: '1.0.0',
  name: 'Rows Three Step Schema',
  phases: [
    {
      id: 'first',
      name: 'First',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' },
      },
      selectionPipeline: passAll,
    },
    {
      id: 'second',
      name: 'Second',
      rules: { advancement: { method: 'date' } },
      selectionPipeline: passAll,
    },
    {
      id: 'third',
      name: 'Third',
      rules: { advancement: { method: 'date' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

describe('phases read from rows', () => {
  it('getInstance returns no phases for a decision that has no phase rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    await testData.removePhaseRows(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const instance = await caller.decision.getInstance({ instanceId });

    expect(instance.instanceData.phases).toEqual([]);
  });

  it('reads a rule saved between two advances in one sweep', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      processSchema: threeStepDateSchema,
    });
    const instanceId = setup.instance.instance.id;
    const hourMs = 60 * 60 * 1000;
    await db.insert(decisionProcessTransitions).values([
      {
        processInstanceId: instanceId,
        fromStateId: 'first',
        toStateId: 'second',
        scheduledDate: new Date(Date.now() + hourMs).toISOString(),
      },
      {
        processInstanceId: instanceId,
        fromStateId: 'second',
        toStateId: 'third',
        scheduledDate: new Date(Date.now() + 2 * hourMs).toISOString(),
      },
    ]);

    // While the first advance runs, an admin makes the second phase manual.
    onTestFinished(() => {
      vi.mocked(onPhaseAdvanced).mockReset();
    });
    vi.mocked(onPhaseAdvanced).mockImplementationOnce(async () => {
      await db
        .update(processPhases)
        .set({
          data: sql`${processPhases.data} || '{"rules":{"advancement":{"method":"manual"}}}'::jsonb`,
        })
        .where(
          and(
            eq(processPhases.processInstanceId, instanceId),
            sql`${processPhases.data} ->> 'phaseId' = 'second'`,
          ),
        );
      await db
        .delete(decisionProcessTransitions)
        .where(
          and(
            eq(decisionProcessTransitions.processInstanceId, instanceId),
            eq(decisionProcessTransitions.fromStateId, 'second'),
            isNull(decisionProcessTransitions.completedAt),
          ),
        );
    });

    const result = await processDecisionsTransitions({
      processInstanceId: instanceId,
      now: new Date(Date.now() + 3 * hourMs).toISOString(),
    });

    expect(result).toMatchObject({ processed: 1, failed: 0 });
    expect(onPhaseAdvanced).toHaveBeenCalledTimes(1);
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
      columns: { currentStateId: true },
    });
    expect(instance?.currentStateId).toBe('second');
  });
});

describe('getInstance with hideBudget', () => {
  it('strips phase budgets from the rows', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { id: instanceId, instanceData } = setup.instance.instance;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          config: { ...instanceData.config, hideBudget: true },
        },
      })
      .where(eq(processInstances.id, instanceId));
    await updateInstancePhases({
      instanceId,
      update: (phases) =>
        phases.map((phase) => ({ ...phase, settings: { budget: 1000 } })),
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const instance = await caller.decision.getInstance({ instanceId });

    expect(
      instance.instanceData.phases?.map(({ settings }) => settings),
    ).toEqual([{}, {}]);
  });
});
