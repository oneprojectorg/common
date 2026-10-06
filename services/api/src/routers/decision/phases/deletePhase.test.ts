import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  createUnauthenticatedCaller,
  setupPhase,
} from '../../../test/helpers/phaseTestUtils';

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
    ).rejects.toThrow(/not found/i);
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
});

const expectPhaseExists = async (phaseId: string) => {
  const row = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { id: true },
  });
  expect(row).toBeDefined();
};
