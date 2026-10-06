import { createPhase } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

// Access control is covered through the routers in
// routers/decision/phases/*.test.ts; these tests pin what the service writes.
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
      data: { phaseId: 'submissions' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.type).toBe(EntityType.PHASE);
    expect(profile.name).toBe('Submissions');
    expect(phase.profileId).toBe(profile.id);
    expect(phase.processInstanceId).toBe(instanceId);
    expect(phase.sortOrder).toBe(0);
    expect(phase.data).toEqual({ phaseId: 'submissions' });
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
      data: { phaseId: 'review' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.slug).toMatch(/^[0-9a-f]{8}$/);
  });

  it('rejects data with an empty phaseId and writes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user } = await setup(task, onTestFinished);

    // phaseId is what joins the row to its entry in instance_data.phases.
    const name = `Nameless ${randomUUID()}`;
    await expect(
      createPhase({
        user,
        processInstanceId: instanceId,
        name,
        sortOrder: 0,
        data: { phaseId: '' },
      }),
    ).rejects.toThrow(ZodError);

    await expectNoProfileNamed(name);
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
      data: { phaseId: 'review' },
    });
    testData.trackProfileForCleanup(profile.id);

    // Invite-only grants are written when an invite is accepted, not here.
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

    // 2^31 overflows the integer sort_order column, so the phase insert fails
    // after the profile insert has run.
    const name = `Orphan Check ${randomUUID()}`;
    await expect(
      createPhase({
        user,
        processInstanceId: instanceId,
        name,
        sortOrder: 2 ** 31,
        data: { phaseId: 'submissions' },
      }),
      // 22003: numeric_value_out_of_range, raised by the phase insert itself.
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
