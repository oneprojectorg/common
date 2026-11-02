import {
  type DecisionSchemaDefinition,
  invalidateDecisionInstance,
  processDecisionsTransitions,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, like, sql } from '@op/db/client';
import {
  ProcessStatus,
  contentTranslations,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import { logger } from '@op/logging';
import { describe, expect, it } from 'vitest';

import { createAuthenticatedCaller } from '../../test/supabase-utils';

const dateSchema = {
  id: 'stale-blob-date',
  version: '1.0.0',
  name: 'Stale Blob Date Schema',
  phases: [
    {
      id: 'initial',
      name: 'Initial',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' },
      },
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'final',
      name: 'Final',
      rules: { advancement: { method: 'date' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

// Renamed, reordered, rules changed and one phase added: every reader that
// still takes the blob gets a different answer from the rows.
const STALE_BLOB_PHASES = [
  {
    phaseId: 'stale-extra',
    name: 'Stale extra',
    rules: { advancement: { method: 'manual' } },
  },
  {
    phaseId: 'final',
    name: 'Stale final',
    rules: { advancement: { method: 'manual' } },
  },
  {
    phaseId: 'initial',
    name: 'Stale initial',
    rules: { proposals: { submit: false }, advancement: { method: 'manual' } },
  },
];

const ROW_PHASES = [
  { phaseId: 'initial', name: 'Initial' },
  { phaseId: 'final', name: 'Final' },
];

const makeBlobStale = async (instanceId: string) => {
  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(STALE_BLOB_PHASES)}::jsonb)`,
    })
    .where(eq(processInstances.id, instanceId));
  await invalidateDecisionInstance(instanceId);
};

// Not concurrent: the transitions sweep is global.
describe('phase reads with a stale instanceData.phases', () => {
  it('takes phase names, order and rules from the rows in every reader', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: dateSchema,
    });
    const { instance } = setup;
    const instanceId = instance.instance.id;
    await makeBlobStale(instanceId);
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `decision:${instance.profileId}:%`,
          ),
        );
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const fetched = await caller.decision.getInstance({ instanceId });
    expect(
      fetched.instanceData.phases?.map(({ phaseId, name }) => ({
        phaseId,
        name,
      })),
    ).toEqual(ROW_PHASES);
    expect(fetched.instanceData.phases?.[0]?.rules).toMatchObject({
      proposals: { submit: true },
      advancement: { method: 'date' },
    });

    const list = await caller.decision.listDecisionProfiles({});
    const listed = list.items.find(
      (item) => item.processInstance.id === instanceId,
    );
    expect(
      listed?.processInstance.instanceData.phases?.map(({ phaseId, name }) => ({
        phaseId,
        name,
      })),
    ).toEqual(ROW_PHASES);

    const translated = await caller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });
    expect(translated.phases.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'initial', name: '[ES] Initial' },
      { id: 'final', name: '[ES] Final' },
    ]);

    // The blob lists `initial` last, so only the rows have a phase after it.
    const advanced = await caller.decision.transitionFromPhase({ instanceId });
    expect(advanced).toEqual({
      previousPhaseId: 'initial',
      currentPhaseId: 'final',
    });
  });

  it('runs a due transition the rows date but the blob makes manual', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      processSchema: dateSchema,
    });
    const instanceId = setup.instance.instance.id;
    await makeBlobStale(instanceId);
    // Not yet due, so no other worker's sweep can take it.
    await db.insert(decisionProcessTransitions).values({
      processInstanceId: instanceId,
      fromStateId: 'initial',
      toStateId: 'final',
      scheduledDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const result = await processDecisionsTransitions({
      processInstanceId: instanceId,
      now: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    expect(result).toMatchObject({ processed: 1, failed: 0 });
    const reloaded = await db.query.processInstances.findFirst({
      where: { id: instanceId },
      columns: { currentStateId: true },
    });
    expect(reloaded?.currentStateId).toBe('final');
  });

  it('reads no phases and warns when the decision has no rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: dateSchema,
    });
    const instanceId = setup.instance.instance.id;
    await testData.removePhaseRows(instanceId);
    await invalidateDecisionInstance(instanceId);
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const fetched = await caller.decision.getInstance({ instanceId });

    expect(fetched.instanceData.phases).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no phase rows'),
      { processInstanceIds: [instanceId] },
    );
  });
});
