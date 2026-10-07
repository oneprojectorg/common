import type { PhaseData } from '@op/common';
import { db } from '@op/db/client';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  PHASE_NAME,
  createUnauthenticatedCaller,
  setupPhase,
} from '../../../test/helpers/phaseTestUtils';

describe.concurrent('updatePhase', () => {
  it('renames the phase and keeps the slug and data', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      name: 'Final Review',
    });

    expect(result).toEqual({
      id: phase.id,
      profileId: phase.profileId,
      name: 'Final Review',
      slug: phase.slug,
      data: {},
    });
  });

  it('merges data into what is stored and keeps the name', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { description: 'Pitch an idea', headline: 'Submit' },
    });
    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { endDate: '2026-12-01T00:00:00.000Z' },
    });

    expect(result).toMatchObject({
      name: PHASE_NAME,
      data: {
        description: 'Pitch an idea',
        headline: 'Submit',
        endDate: '2026-12-01T00:00:00.000Z',
      },
    });
  });

  it('clears a field set to null and keeps the rest', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { description: 'Pitch an idea', headline: 'Submit' },
    });
    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { headline: null },
    });

    await expectPhase(phase, {
      name: PHASE_NAME,
      data: { description: 'Pitch an idea' },
    });
  });

  it('updates the name and data together', async ({ task, onTestFinished }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      name: 'Final Review',
      data: { description: 'Pitch an idea' },
    });

    await expectPhase(phase, {
      name: 'Final Review',
      data: { description: 'Pitch an idea' },
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
      caller.decision.updatePhase({
        phaseId: phase.id,
        name: 'Nope',
        data: { description: 'Hijacked' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectPhase(phase, UNCHANGED);
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
      caller.decision.updatePhase({
        phaseId: phase.id,
        name: 'Nope',
        data: { description: 'Hijacked' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectPhase(phase, UNCHANGED);
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
      caller.decision.updatePhase({ phaseId: phase.id, name: 'Nope' }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expectPhase(phase, UNCHANGED);
  });

  it('returns not found for an unknown phase', async ({
    task,
    onTestFinished,
  }) => {
    const { adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhase({ phaseId: randomUUID(), name: 'X' }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects bad input', async ({ task, onTestFinished }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const badInputs = [
      { phaseId: phase.id },
      { phaseId: phase.id, name: '  ' },
      { phaseId: phase.id, data: { startDate: 'tomorrow' } },
      { phaseId: 'not-a-uuid', name: 'X' },
    ];

    for (const input of badInputs) {
      await expect(
        adminCaller.decision.updatePhase(input),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }

    await expectPhase(phase, UNCHANGED);
  });

  it('requires authentication', async () => {
    const caller = await createUnauthenticatedCaller();

    await expect(
      caller.decision.updatePhase({ phaseId: randomUUID(), name: 'X' }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessTierError', callerTier: 'none' },
    });
  });
});

const UNCHANGED = { name: PHASE_NAME, data: {} };

const expectPhase = async (
  phase: { id: string; profileId: string },
  expected: { name: string; data: PhaseData },
) => {
  const [profile, row] = await Promise.all([
    db.query.profiles.findFirst({
      where: { id: phase.profileId },
      columns: { name: true },
    }),
    db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { data: true },
    }),
  ]);
  expect(profile?.name).toBe(expected.name);
  expect(row?.data).toEqual(expected.data);
};
