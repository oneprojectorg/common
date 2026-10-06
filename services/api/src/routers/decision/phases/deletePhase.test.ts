import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { setupPhase } from '../../../test/helpers/phaseTestUtils';

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
    const { phase, memberCaller } = await setupPhase(task, onTestFinished);

    await expect(
      memberCaller.decision.deletePhase({ phaseId: phase.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const row = await db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { id: true },
    });
    expect(row).toBeDefined();
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
});
