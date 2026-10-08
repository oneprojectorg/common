import { MAX_PHASES_PER_DECISION } from '@op/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  PHASE_NAME,
  createUnauthenticatedCaller,
  setupPhase,
} from '../../../test/helpers/phaseTestUtils';

describe.concurrent('reorderPhases', () => {
  it('sets the new order and returns the phases in it', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, instanceId, adminCaller } = await setupPhases(
      task,
      onTestFinished,
    );
    const [review, vote, results] = phases;

    const result = await adminCaller.decision.reorderPhases({
      instanceId,
      phases: [
        { phaseId: results.id },
        { phaseId: review.id },
        { phaseId: vote.id },
      ],
    });

    expect(
      result.items.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
    ).toEqual([
      { id: results.id, name: 'Results', sortOrder: 0 },
      { id: review.id, name: PHASE_NAME, sortOrder: 1 },
      { id: vote.id, name: 'Vote', sortOrder: 2 },
    ]);
  });

  it('moves the dates sent with the order and keeps the rest of the data', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, instanceId, adminCaller } = await setupPhases(
      task,
      onTestFinished,
    );
    const [review, vote, results] = phases;
    await adminCaller.decision.updatePhase({
      phaseId: vote.id,
      data: {
        description: 'Cast a ballot',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-07T00:00:00.000Z',
      },
    });

    const result = await adminCaller.decision.reorderPhases({
      instanceId,
      phases: [
        {
          phaseId: vote.id,
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-07T00:00:00.000Z',
        },
        { phaseId: review.id },
        { phaseId: results.id },
      ],
    });

    expect(result.items[0]).toMatchObject({
      id: vote.id,
      data: {
        description: 'Cast a ballot',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-07T00:00:00.000Z',
      },
    });
    expect(result.items[1]?.data).toEqual({});
  });

  it('refuses a list that leaves out, repeats or adds a phase', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, instanceId, adminCaller } = await setupPhases(
      task,
      onTestFinished,
    );
    const [review, vote, results] = phases;

    const badLists = [
      [{ phaseId: review.id }, { phaseId: vote.id }],
      [{ phaseId: review.id }, { phaseId: vote.id }, { phaseId: vote.id }],
      [{ phaseId: review.id }, { phaseId: vote.id }, { phaseId: randomUUID() }],
      [
        { phaseId: review.id },
        { phaseId: vote.id },
        { phaseId: results.id },
        { phaseId: randomUUID() },
      ],
    ];

    for (const list of badLists) {
      await expect(
        adminCaller.decision.reorderPhases({ instanceId, phases: list }),
      ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    }

    const unchanged = await adminCaller.decision.reorderPhases({
      instanceId,
      phases: phases.map((phase) => ({ phaseId: phase.id })),
    });
    expect(unchanged.items.map((phase) => phase.id)).toEqual(
      phases.map((phase) => phase.id),
    );
  });

  it('refuses a phase from another decision', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, instanceId, adminCaller } = await setupPhases(
      task,
      onTestFinished,
    );
    const other = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.reorderPhases({
        instanceId,
        phases: [
          ...phases.slice(1).map((phase) => ({ phaseId: phase.id })),
          { phaseId: other.phase.id },
        ],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects a member without decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, instanceId, createMemberCaller } = await setupPhases(
      task,
      onTestFinished,
    );
    const caller = await createMemberCaller();

    await expect(
      caller.decision.reorderPhases({
        instanceId,
        phases: [...phases].reverse().map((phase) => ({ phaseId: phase.id })),
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const [review] = phases;
    await expect(
      caller.decision.reorderPhases({
        instanceId,
        phases: [{ phaseId: review.id }, { phaseId: review.id }],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects the admin of a different decision', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, instanceId, createOtherDecisionAdminCaller } =
      await setupPhases(task, onTestFinished);
    const caller = await createOtherDecisionAdminCaller();

    await expect(
      caller.decision.reorderPhases({
        instanceId,
        phases: [...phases].reverse().map((phase) => ({ phaseId: phase.id })),
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('returns not found for an unknown decision', async ({
    task,
    onTestFinished,
  }) => {
    const { phases, adminCaller } = await setupPhases(task, onTestFinished);

    await expect(
      adminCaller.decision.reorderPhases({
        instanceId: randomUUID(),
        phases: phases.map((phase) => ({ phaseId: phase.id })),
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects bad input', async ({ task, onTestFinished }) => {
    const { phases, instanceId, adminCaller } = await setupPhases(
      task,
      onTestFinished,
    );
    const [review, vote, results] = phases;

    const badInputs = [
      { instanceId, phases: [] },
      { instanceId: 'not-a-uuid', phases: [{ phaseId: review.id }] },
      {
        instanceId,
        phases: [
          { phaseId: review.id, startDate: 'tomorrow' },
          { phaseId: vote.id },
          { phaseId: results.id },
        ],
      },
      {
        instanceId,
        phases: Array.from({ length: MAX_PHASES_PER_DECISION + 1 }, () => ({
          phaseId: randomUUID(),
        })),
      },
    ];

    for (const input of badInputs) {
      await expect(
        adminCaller.decision.reorderPhases(input),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
  });

  it('requires authentication', async () => {
    const caller = await createUnauthenticatedCaller();

    await expect(
      caller.decision.reorderPhases({
        instanceId: randomUUID(),
        phases: [{ phaseId: randomUUID() }],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessTierError', callerTier: 'none' },
    });
  });
});

type OnTestFinished = Parameters<typeof setupPhase>[1];

const setupPhases = async (
  task: { id: string },
  onTestFinished: OnTestFinished,
) => {
  const setup = await setupPhase(task, onTestFinished);
  const instanceId = setup.phase.processInstanceId;

  const [vote, results] = await Promise.all(
    ['Vote', 'Results'].map((name, index) =>
      setup.adminCaller.decision.createPhase({
        instanceId,
        name,
        sortOrder: index + 1,
      }),
    ),
  );
  if (!vote || !results) {
    throw new Error('Failed to create the test phases');
  }
  setup.trackProfileForCleanup(vote.profileId);
  setup.trackProfileForCleanup(results.profileId);

  return {
    ...setup,
    instanceId,
    phases: [setup.phase, vote, results] as const,
  };
};
