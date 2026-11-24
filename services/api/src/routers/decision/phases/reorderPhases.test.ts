import { MAX_PHASES_PER_DECISION } from '@op/common';
import { loadPhaseRows } from '@op/common/testing';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  DAY_MS,
  PHASE_NAME,
  createUnauthenticatedCaller,
  loadTransitionLinks,
  setupDraftDecisionWithPastPhases,
  setupPhase,
  setupPublishedDateDecision,
  setupPublishedDecisionAtThirdPhase,
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

  it('reschedules and relinks the transitions of a published decision', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, initial, final, endDate } =
      await setupPublishedDateDecision(task, onTestFinished);
    const extra = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Extra',
      sortOrder: 2,
    });
    expect(await loadTransitionLinks(instanceId)).toEqual([
      {
        fromStateId: 'initial',
        toStateId: 'final',
        fromPhaseId: initial.id,
        toPhaseId: final.id,
        scheduledDate: endDate,
      },
    ]);

    await adminCaller.decision.reorderPhases({
      instanceId,
      phases: [initial, extra, final].map(({ id }) => ({ phaseId: id })),
    });

    expect(await loadTransitionLinks(instanceId)).toEqual([
      {
        fromStateId: 'initial',
        toStateId: extra.slug,
        fromPhaseId: initial.id,
        toPhaseId: extra.id,
        scheduledDate: endDate,
      },
    ]);

    const linksBefore = await loadTransitionLinks(instanceId);
    await expect(
      adminCaller.decision.reorderPhases({
        instanceId,
        phases: [extra, final, initial].map(({ id }) => ({ phaseId: id })),
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message:
          'Phases up to the current phase cannot be removed, added or reordered',
      },
    });

    expect(await loadTransitionLinks(instanceId)).toEqual(linksBefore);
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

describe.concurrent('reorderPhases past phases', () => {
  it('refuses swapping two phases the decision has left', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, rows } =
      await setupPublishedDecisionAtThirdPhase(task, onTestFinished);
    const rowsBefore = await loadPhaseRows(instanceId);

    await expect(
      adminCaller.decision.reorderPhases({
        instanceId,
        phases: [rows.review, rows.submission, rows.voting, rows.results].map(
          ({ id }) => ({ phaseId: id }),
        ),
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message:
          'Phases up to the current phase cannot be removed, added or reordered',
      },
    });

    expect(await loadPhaseRows(instanceId)).toEqual(rowsBefore);
  });

  it.for([
    {
      label: 'a new end date on a past phase',
      phase: 'review',
      dates: { endDate: new Date(Date.now() + 20 * DAY_MS).toISOString() },
      message: 'The past phase "Review" cannot be edited',
    },
    {
      label: 'a new start date on the current phase',
      phase: 'voting',
      dates: { startDate: new Date(Date.now() - DAY_MS).toISOString() },
      message: 'The start date of the current phase cannot be changed',
    },
  ] as const)(
    'refuses $label sent with the order',
    async ({ phase, dates, message }, { task, onTestFinished }) => {
      const { instanceId, adminCaller, rows } =
        await setupPublishedDecisionAtThirdPhase(task, onTestFinished);
      const rowsBefore = await loadPhaseRows(instanceId);

      await expect(
        adminCaller.decision.reorderPhases({
          instanceId,
          phases: rowsBefore.map(({ id }) =>
            id === rows[phase].id ? { phaseId: id, ...dates } : { phaseId: id },
          ),
        }),
      ).rejects.toMatchObject({ cause: { name: 'ValidationError', message } });

      expect(await loadPhaseRows(instanceId)).toEqual(rowsBefore);
    },
  );

  it('accepts the same order with new dates on a later phase', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, rows } =
      await setupPublishedDecisionAtThirdPhase(task, onTestFinished);
    const startDate = new Date(Date.now() + 5 * DAY_MS).toISOString();
    const endDate = new Date(Date.now() + 10 * DAY_MS).toISOString();

    await adminCaller.decision.reorderPhases({
      instanceId,
      phases: [
        { phaseId: rows.submission.id },
        { phaseId: rows.review.id },
        { phaseId: rows.voting.id },
        { phaseId: rows.results.id, startDate, endDate },
      ],
    });

    expect(await loadPhaseRows(instanceId)).toMatchObject([
      { id: rows.submission.id, data: rows.submission.data },
      { id: rows.review.id, data: rows.review.data },
      { id: rows.voting.id, data: rows.voting.data },
      {
        id: rows.results.id,
        data: { ...rows.results.data, startDate, endDate },
      },
    ]);
  });

  it('swaps two phases the decision has left while it is a draft', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, rows } =
      await setupDraftDecisionWithPastPhases(task, onTestFinished);

    await adminCaller.decision.reorderPhases({
      instanceId,
      phases: [rows.review, rows.submission, rows.voting, rows.results].map(
        ({ id }) => ({ phaseId: id }),
      ),
    });

    expect((await loadPhaseRows(instanceId)).map(({ id }) => id)).toEqual([
      rows.review.id,
      rows.submission.id,
      rows.voting.id,
      rows.results.id,
    ]);
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
