import { ValidationError, createPhase } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe.concurrent('createPhase', () => {
  it('mints a profile of type PHASE that owns the name', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: 'Submissions',
      sortOrder: 0,
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.type).toBe(EntityType.PHASE);
    expect(profile.name).toBe('Submissions');
    expect(phase.profileId).toBe(profile.id);
    expect(phase.processInstanceId).toBe(instanceId);
    expect(phase.sortOrder).toBe(0);
    expect(phase.data).toEqual({});
  });

  it('slugs the profile with 8 hex chars, not the name', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: 'Review Round',
      sortOrder: 1,
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.slug).toMatch(/^[0-9a-f]{8}$/);
  });

  it('stores the given data', async ({ task, onTestFinished }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: 'Submissions',
      sortOrder: 0,
      data: { description: 'Pitch an idea', headline: 'Pitch' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(phase.data).toEqual({
      description: 'Pitch an idea',
      headline: 'Pitch',
    });
  });

  it('rejects an invalid rubric template and writes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user } = await setup(task, onTestFinished);

    const name = `Nameless ${randomUUID()}`;
    await expect(
      createPhase({
        user,
        processInstanceId: instanceId,
        name,
        sortOrder: 0,
        data: { rubricTemplate: { type: 'object', minProperties: -1 } },
      }),
    ).rejects.toThrow(ValidationError);

    await expectNoProfileNamed(name);
  });

  it('stores settings that match the settings schema beside them', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const data = {
      settingsSchema: {
        type: 'object' as const,
        required: ['maxVotesPerMember'],
        properties: {
          maxVotesPerMember: { type: 'number' as const, minimum: 1 },
        },
        ui: { maxVotesPerMember: { 'ui:widget': 'number' } },
      },
      settings: { maxVotesPerMember: 5 },
    };
    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: 'Voting',
      sortOrder: 0,
      data,
    });
    testData.trackProfileForCleanup(profile.id);

    expect(phase.data).toEqual(data);
  });

  it.for([
    ['settings without a settings schema', { settings: { budget: 100 } }],
    [
      'settings that do not match the schema',
      {
        settingsSchema: {
          type: 'object' as const,
          properties: { budget: { type: 'number' as const, minimum: 0 } },
        },
        settings: { budget: 'lots' },
      },
    ],
    [
      'a settings schema that does not compile',
      { settingsSchema: { type: 'object' as const, minProperties: -1 } },
    ],
  ] as const)(
    'rejects %s and writes nothing',
    async ([, data], { task, onTestFinished }) => {
      const { instanceId, user } = await setup(task, onTestFinished);

      const name = `Unsettled ${randomUUID()}`;
      await expect(
        createPhase({
          user,
          processInstanceId: instanceId,
          name,
          sortOrder: 0,
          data,
        }),
      ).rejects.toThrow(ValidationError);

      await expectNoProfileNamed(name);
    },
  );

  it('stores a selection pipeline with every block field intact', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const selectionPipeline = {
      version: '1.0.0',
      blocks: [
        {
          id: 'enough-votes',
          type: 'filter' as const,
          condition: {
            operator: 'greaterThanOrEquals' as const,
            left: { field: 'voteData.voteCount' },
            right: { value: 3 },
          },
        },
        { id: 'top', type: 'limit' as const, count: 2 },
      ],
    };
    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: 'Voting',
      sortOrder: 0,
      data: { selectionPipeline },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(phase.data).toEqual({ selectionPipeline });
  });

  it('writes no roles and no members on the phase profile', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: 'Review',
      sortOrder: 0,
    });
    testData.trackProfileForCleanup(profile.id);

    const [roles, members] = await Promise.all([
      db.query.accessRoles.findMany({
        where: { profileId: profile.id },
        columns: { id: true },
      }),
      db.query.profileUsers.findMany({
        where: { profileId: profile.id },
        columns: { id: true },
      }),
    ]);
    expect(roles).toHaveLength(0);
    expect(members).toHaveLength(0);
  });

  it('rolls the profile back when the phase insert fails', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user } = await setup(task, onTestFinished);

    // Overflows sort_order, so the phase insert fails after the profile insert.
    const name = `Orphan Check ${randomUUID()}`;
    await expect(
      createPhase({
        user,
        processInstanceId: instanceId,
        name,
        sortOrder: 2 ** 31,
      }),
      // 22003: numeric_value_out_of_range
    ).rejects.toMatchObject({ cause: { code: '22003' } });

    await expectNoProfileNamed(name);
  });
});

const setup = async (
  task: { id: string },
  onTestFinished: (fn: () => void | Promise<void>) => void,
) => {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const decisionSetup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  return {
    instanceId: decisionSetup.instance.instance.id,
    user: decisionSetup.user,
    testData,
  };
};

const expectNoProfileNamed = async (name: string) => {
  const leftover = await db.query.profiles.findMany({
    where: { name },
    columns: { id: true },
  });
  expect(leftover).toHaveLength(0);
};
