import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  PHASE_NAME,
  createUnauthenticatedCaller,
  setupPhase,
} from '../../../test/helpers/phaseTestUtils';

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
    const { phase, createMemberCaller } = await setupPhase(
      task,
      onTestFinished,
    );
    const caller = await createMemberCaller();

    await expect(
      caller.decision.renamePhase({ phaseId: phase.id, name: 'Nope' }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectName(phase.profileId, PHASE_NAME);
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
      caller.decision.renamePhase({ phaseId: phase.id, name: 'Nope' }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectName(phase.profileId, PHASE_NAME);
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
      caller.decision.renamePhase({ phaseId: phase.id, name: 'Nope' }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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

  it('rejects an empty name and a non-UUID phaseId', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.renamePhase({ phaseId: phase.id, name: '  ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      adminCaller.decision.renamePhase({ phaseId: 'not-a-uuid', name: 'X' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('requires authentication', async () => {
    const caller = await createUnauthenticatedCaller();

    await expect(
      caller.decision.renamePhase({ phaseId: randomUUID(), name: 'X' }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessTierError', callerTier: 'none' },
    });
  });
});

const expectName = async (profileId: string, name: string) => {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { name: true },
  });
  expect(profile?.name).toBe(name);
};
