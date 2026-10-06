import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { setupPhase } from '../../../test/helpers/phaseTestUtils';

describe.concurrent('updatePhaseData', () => {
  it('replaces the phase data', async ({ task, onTestFinished }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const result = await adminCaller.decision.updatePhaseData({
      phaseId: phase.id,
      data: { phaseId: 'final-review' },
    });

    expect(result).toEqual({
      id: phase.id,
      data: { phaseId: 'final-review' },
    });
  });

  it('rejects a member without decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, memberCaller } = await setupPhase(task, onTestFinished);

    await expect(
      memberCaller.decision.updatePhaseData({
        phaseId: phase.id,
        data: { phaseId: 'hijacked' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const row = await db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { data: true },
    });
    expect(row?.data).toEqual({ phaseId: 'review' });
  });

  it('returns not found for an unknown phase', async ({
    task,
    onTestFinished,
  }) => {
    const { adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhaseData({
        phaseId: randomUUID(),
        data: { phaseId: 'review' },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects an empty phaseId', async ({ task, onTestFinished }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhaseData({
        phaseId: phase.id,
        data: { phaseId: '' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
