import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { setupPhase } from '../../../test/helpers/phaseTestUtils';

describe.concurrent('renamePhase', () => {
  it('renames the phase profile and keeps the slug', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const result = await adminCaller.decision.renamePhase({
      phaseId: phase.id,
      name: 'Final Review',
    });

    expect(result).toEqual({
      profileId: phase.profileId,
      name: 'Final Review',
      slug: phase.slug,
    });
  });

  it('rejects a member without decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, memberCaller } = await setupPhase(task, onTestFinished);

    await expect(
      memberCaller.decision.renamePhase({ phaseId: phase.id, name: 'Nope' }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const profile = await db.query.profiles.findFirst({
      where: { id: phase.profileId },
      columns: { name: true },
    });
    expect(profile?.name).toBe('Review');
  });

  it('returns not found for an unknown phase', async ({
    task,
    onTestFinished,
  }) => {
    const { adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.renamePhase({ phaseId: randomUUID(), name: 'X' }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects an empty name', async ({ task, onTestFinished }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.renamePhase({ phaseId: phase.id, name: '  ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
