import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  PHASE_NAME,
  createUnauthenticatedCaller,
  loadBlobPhases,
  reorderBlobPhases,
  setupPhase,
} from '../../../test/helpers/phaseTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

describe.concurrent('deletePhase', () => {
  it('deletes the phase and its profile', async ({ task, onTestFinished }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

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

  it('keeps the blob order of the phases that have no row', async ({
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
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const first = await adminCaller.decision.createPhase({
      instanceId,
      name: 'First',
      sortOrder: 0,
    });
    testData.trackProfileForCleanup(first.profileId);
    const second = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Second',
      sortOrder: 1,
    });
    testData.trackProfileForCleanup(second.profileId);
    await reorderBlobPhases(instanceId, [
      first.slug,
      second.slug,
      'initial',
      'final',
    ]);

    await adminCaller.decision.deletePhase({ phaseId: first.id });

    const blobPhases = await loadBlobPhases(instanceId);
    expect(blobPhases.map(({ phaseId }) => phaseId)).toEqual([
      second.slug,
      'initial',
      'final',
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
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
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
