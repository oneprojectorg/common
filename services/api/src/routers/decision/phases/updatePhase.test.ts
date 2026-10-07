import type { PhaseData } from '@op/common';
import { db, eq } from '@op/db/client';
import { processPhases } from '@op/db/schema';
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

  it('sets a rubric template and clears it with the headline', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: {
        description: 'Pitch an idea',
        headline: 'Submit',
        rubricTemplate: RUBRIC_TEMPLATE,
      },
    });
    expect(result.data.rubricTemplate).toEqual(RUBRIC_TEMPLATE);

    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { headline: null, rubricTemplate: null },
    });

    await expectPhase(phase, {
      name: PHASE_NAME,
      data: { description: 'Pitch an idea' },
    });
  });

  it('rejects a rubric template that is not a valid JSON Schema', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { rubricTemplate: notASchema() },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expectPhase(phase, UNCHANGED);
  });

  it('keeps every field when updates to different fields run at once', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await Promise.all([
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { description: 'Pitch an idea' },
      }),
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { headline: 'Submit' },
      }),
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { endDate: '2026-12-01T00:00:00.000Z' },
      }),
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        name: 'Final Review',
      }),
    ]);

    await expectPhase(phase, {
      name: 'Final Review',
      data: {
        description: 'Pitch an idea',
        headline: 'Submit',
        endDate: '2026-12-01T00:00:00.000Z',
      },
    });
  });

  it('sets a proposal template and clears it with null', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: {
        description: 'Pitch an idea',
        proposalTemplate: PROPOSAL_TEMPLATE,
      },
    });
    expect(result.data.proposalTemplate).toEqual(PROPOSAL_TEMPLATE);

    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { proposalTemplate: null },
    });

    await expectPhase(phase, {
      name: PHASE_NAME,
      data: { description: 'Pitch an idea' },
    });
  });

  it('rejects a proposal template that is not a valid JSON Schema', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { proposalTemplate: notASchema() },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expectPhase(phase, UNCHANGED);
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

  it('checks new settings against the stored settings schema', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { settingsSchema: BUDGET_SCHEMA, settings: { budget: 100 } },
    });

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { settings: { budget: 250 } },
    });
    expect(result.data).toEqual({
      settingsSchema: BUDGET_SCHEMA,
      settings: { budget: 250 },
    });

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        name: 'Renamed',
        data: { settings: { budget: -1 } },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expectPhase(phase, {
      name: PHASE_NAME,
      data: { settingsSchema: BUDGET_SCHEMA, settings: { budget: 250 } },
    });
  });

  it('rejects a new settings schema the stored settings break', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { settingsSchema: BUDGET_SCHEMA, settings: { budget: 100 } },
    });

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: {
          settingsSchema: { ...BUDGET_SCHEMA, required: ['maxVotesPerMember'] },
        },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expectPhase(phase, {
      name: PHASE_NAME,
      data: { settingsSchema: BUDGET_SCHEMA, settings: { budget: 100 } },
    });
  });

  it('accepts a new settings schema the stored settings satisfy', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { settingsSchema: BUDGET_SCHEMA, settings: { budget: 100 } },
    });
    const looserSchema = {
      type: 'object' as const,
      properties: { budget: { type: 'number' as const } },
    };

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { settingsSchema: looserSchema },
    });

    expect(result.data).toEqual({
      settingsSchema: looserSchema,
      settings: { budget: 100 },
    });
  });

  it('accepts a settings schema on a phase with no settings', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { settingsSchema: BUDGET_SCHEMA },
    });

    expect(result.data).toEqual({ settingsSchema: BUDGET_SCHEMA });
  });

  it('rejects a settings schema that is not a valid JSON Schema', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { settingsSchema: notASchema() },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expectPhase(phase, UNCHANGED);
  });

  it('rejects settings when no schema is stored or sent', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { settings: { budget: 100 } },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expectPhase(phase, UNCHANGED);
  });

  it('still edits a converted phase that holds settings without a schema', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    await db
      .update(processPhases)
      .set({ data: { settings: { budget: 100 } } })
      .where(eq(processPhases.id, phase.id));

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { description: 'Pitch an idea' },
    });

    expect(result.data).toEqual({
      settings: { budget: 100 },
      description: 'Pitch an idea',
    });
  });

  it('checks the settings of a converted phase once they are touched', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    const converted = { name: PHASE_NAME, data: { settings: { budget: -1 } } };
    await db
      .update(processPhases)
      .set({ data: converted.data })
      .where(eq(processPhases.id, phase.id));

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { settingsSchema: BUDGET_SCHEMA },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expect(
      adminCaller.decision.updatePhase({
        phaseId: phase.id,
        data: { settings: { budget: 5 } },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    await expectPhase(phase, converted);
  });

  it('returns a converted phase whose stored headline is blank', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    await db
      .update(processPhases)
      .set({ data: { headline: '  ' } })
      .where(eq(processPhases.id, phase.id));

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { description: 'Pitch an idea' },
    });

    expect(result.data).toEqual({ description: 'Pitch an idea' });
  });

  it('returns a stored pipeline with every block field intact', async ({
    task,
    onTestFinished,
  }) => {
    const { phase, adminCaller } = await setupPhase(task, onTestFinished);
    const selectionPipeline = {
      version: '1.0.0',
      blocks: [
        {
          id: 'funded',
          type: 'filter' as const,
          condition: {
            operator: 'greaterThan' as const,
            left: { field: 'voteData.approvalRate' },
            right: { value: 0.5 },
          },
        },
      ],
    };

    const result = await adminCaller.decision.updatePhase({
      phaseId: phase.id,
      data: { selectionPipeline },
    });

    expect(result.data).toEqual({ selectionPipeline });
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

const BUDGET_SCHEMA = {
  type: 'object' as const,
  properties: { budget: { type: 'number' as const, minimum: 0 } },
};

const RUBRIC_TEMPLATE = {
  type: 'object' as const,
  properties: {
    score: { type: 'integer' as const, minimum: 1, maximum: 5 },
  },
};

const PROPOSAL_TEMPLATE = {
  type: 'object' as const,
  properties: { budget: { type: 'number' as const, minimum: 0 } },
};

// Ajv's meta-schema rejects a negative minLength. A fresh object per call:
// Ajv caches a schema object before checking it, so a reused one passes.
const notASchema = () => ({ type: 'string' as const, minLength: -1 });

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
