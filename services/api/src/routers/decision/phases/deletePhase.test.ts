import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProcessStatus, decisionProcessTransitions } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  PHASE_NAME,
  createUnauthenticatedCaller,
  loadPendingTransitionLinks,
  loadPhaseRows,
  loadTransitionLinks,
  setupPhase,
  setupPublishedDateDecision,
  setupPublishedDecisionAtThirdPhase,
} from '../../../test/helpers/phaseTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

describe.concurrent('deletePhase', () => {
  it('deletes the phase and its profile', async ({ task, onTestFinished }) => {
    const { phase, adminCaller, trackProfileForCleanup } = await setupPhase(
      task,
      onTestFinished,
    );
    await addPhase({ adminCaller, trackProfileForCleanup, phase });

    await adminCaller.decision.deletePhase({ phaseId: phase.id });

    const [row, profile] = await Promise.all([
      db.query.processPhases.findFirst({
        where: { id: phase.id },
        columns: { id: true },
      }),
      db.query.profiles.findFirst({
        where: { id: phase.profileId },
        columns: { id: true },
      }),
    ]);
    expect(row).toBeUndefined();
    expect(profile).toBeUndefined();
  });

  it.for([ProcessStatus.DRAFT, ProcessStatus.PUBLISHED])(
    'refuses to delete the last phase of a %s decision',
    async (status, { task, onTestFinished }) => {
      const { phase, adminCaller } = await setupPhase(task, onTestFinished);
      await adminCaller.decision.updateDecisionInstance({
        instanceId: phase.processInstanceId,
        status,
      });

      await expect(
        adminCaller.decision.deletePhase({ phaseId: phase.id }),
      ).rejects.toMatchObject({
        cause: {
          name: 'ValidationError',
          message: 'A decision must keep at least one phase',
        },
      });

      await expectPhaseExists(phase.id);
    },
  );

  it('refuses to delete the current phase of a published decision', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, rows } = await setupPublishedDecision(
      task,
      onTestFinished,
    );
    const [current] = rows;
    expect(current).toMatchObject({ data: { phaseId: 'initial' } });
    if (!current) {
      throw new Error('Fixture has no phase rows');
    }

    await expect(
      adminCaller.decision.deletePhase({ phaseId: current.id }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: 'The current phase cannot be deleted',
      },
    });

    expect(await loadPhaseRows(instanceId)).toEqual(rows);
  });

  it('deletes a phase other than the current one from a published decision and unlinks its transitions', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, initial, final } =
      await setupPublishedDateDecision(task, onTestFinished);
    const completedAt = new Date().toISOString();
    await db.insert(decisionProcessTransitions).values({
      processInstanceId: instanceId,
      fromStateId: 'final',
      toStateId: 'initial',
      fromPhaseId: final.id,
      toPhaseId: initial.id,
      scheduledDate: completedAt,
      completedAt,
    });
    expect(await loadTransitionLinks(instanceId)).toMatchObject([
      { fromStateId: 'final', fromPhaseId: final.id, toPhaseId: initial.id },
      { fromStateId: 'initial', fromPhaseId: initial.id, toPhaseId: final.id },
    ]);

    await adminCaller.decision.deletePhase({ phaseId: final.id });

    expect(await loadPhaseRows(instanceId)).toEqual([initial]);
    expect(await loadTransitionLinks(instanceId)).toMatchObject([
      { fromStateId: 'final', fromPhaseId: null, toPhaseId: initial.id },
    ]);
  });

  it('schedules no transition out of a phase the decision has left when an earlier phase is deleted', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, rows } =
      await setupPublishedDecisionAtThirdPhase(task, onTestFinished);

    await adminCaller.decision.deletePhase({ phaseId: rows.review.id });

    expect(await loadPendingTransitionLinks(instanceId)).toEqual([
      {
        fromStateId: 'voting',
        toStateId: 'results',
        fromPhaseId: rows.voting.id,
        toPhaseId: rows.results.id,
      },
    ]);
  });

  it('rejects a member without decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, createMemberCaller } = await setupPhase(
      task,
      onTestFinished,
    );
    const caller = await createMemberCaller();

    await expect(
      caller.decision.deletePhase({ phaseId: phase.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectPhaseExists(phase.id);
  });

  it('rejects the admin of a different decision', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, createOtherDecisionAdminCaller } = await setupPhase(
      task,
      onTestFinished,
    );
    const caller = await createOtherDecisionAdminCaller();

    await expect(
      caller.decision.deletePhase({ phaseId: phase.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectPhaseExists(phase.id);
  });

  it('rejects a user with no access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, createOutsiderCaller } = await setupPhase(
      task,
      onTestFinished,
    );
    const caller = await createOutsiderCaller();

    await expect(
      caller.decision.deletePhase({ phaseId: phase.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectPhaseExists(phase.id);
  });

  it('returns not found for an unknown phase', async ({
    task,
    onTestFinished,
  }) => {
    const { adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.deletePhase({ phaseId: randomUUID() }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a non-UUID phaseId', async ({ task, onTestFinished }) => {
    const { adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.deletePhase({ phaseId: 'not-a-uuid' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('requires authentication', async () => {
    const caller = await createUnauthenticatedCaller();

    await expect(
      caller.decision.deletePhase({ phaseId: randomUUID() }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessTierError', callerTier: 'none' },
    });
  });

  it('drops the deleted phase from the cached instance', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller, trackProfileForCleanup } = await setupPhase(
      task,
      onTestFinished,
    );
    await addPhase({ adminCaller, trackProfileForCleanup, phase });
    const instanceId = phase.processInstanceId;

    const before = await adminCaller.decision.getInstance({ instanceId });
    expect(before.instanceData?.phases?.map(({ name }) => name)).toContain(
      PHASE_NAME,
    );

    await adminCaller.decision.deletePhase({ phaseId: phase.id });

    const after = await adminCaller.decision.getInstance({ instanceId });
    expect(after.instanceData?.phases?.map(({ name }) => name)).not.toContain(
      PHASE_NAME,
    );
  });
});

const expectPhaseExists = async (phaseId: string) => {
  const row = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { id: true },
  });
  expect(row).toBeDefined();
};

const addPhase = async ({
  adminCaller,
  trackProfileForCleanup,
  phase,
}: Pick<
  Awaited<ReturnType<typeof setupPhase>>,
  'adminCaller' | 'trackProfileForCleanup' | 'phase'
>) => {
  const added = await adminCaller.decision.createPhase({
    instanceId: phase.processInstanceId,
    name: 'Kept',
    sortOrder: phase.sortOrder + 1,
  });
  trackProfileForCleanup(added.profileId);
};

const setupPublishedDecision = async (
  task: { id: string },
  onTestFinished: (fn: () => void | Promise<void>) => void,
) => {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;
  const adminCaller = await createAuthenticatedCaller(setup.userEmail);
  await adminCaller.decision.updateDecisionInstance({
    instanceId,
    status: ProcessStatus.PUBLISHED,
  });

  return { instanceId, adminCaller, rows: await loadPhaseRows(instanceId) };
};
