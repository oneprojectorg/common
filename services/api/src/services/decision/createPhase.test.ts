import {
  NotFoundError,
  createPhase,
  deletePhase,
  renamePhase,
} from '@op/common';
import { db } from '@op/db/client';
import { EntityType, PhaseAudience } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';

describe.concurrent('createPhase', () => {
  it('mints a profile of type PHASE that owns the name', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
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
  });

  it('slugs the profile from the name rather than the id', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { profile } = await createPhase({
      processInstanceId: instanceId,
      name: `Review Round ${randomUUID()}`,
      sortOrder: 1,
      data: { phaseId: 'review' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.slug.startsWith('review-round-')).toBe(true);
  });

  it('keeps phaseId in data and the name out of it', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      processInstanceId: instanceId,
      name: 'Voting',
      sortOrder: 2,
      data: { phaseId: 'voting' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(phase.data).toEqual({ phaseId: 'voting' });
  });

  it('rejects data with an empty phaseId', async ({ task, onTestFinished }) => {
    const { instanceId } = await setup(task, onTestFinished);

    // phaseId is what joins the row to its entry in instance_data.phases.
    await expect(
      createPhase({
        processInstanceId: instanceId,
        name: 'Nameless',
        sortOrder: 0,
        data: { phaseId: '' },
      }),
    ).rejects.toThrow();
  });

  it('writes no roles and no members on the phase profile', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { profile } = await createPhase({
      processInstanceId: instanceId,
      name: 'Review',
      sortOrder: 0,
      data: { phaseId: 'review' },
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

  it('defaults the audience to invite-only', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      processInstanceId: instanceId,
      name: 'Review',
      sortOrder: 0,
      data: { phaseId: 'review' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(phase.audience).toBe(PhaseAudience.INVITE_ONLY);
  });

  it('rolls the profile back when the phase insert fails', async ({
    task,
    onTestFinished,
  }) => {
    await setup(task, onTestFinished);

    const name = `Orphan Check ${randomUUID()}`;
    await expect(
      createPhase({
        // No such instance: the FK rejects, and the profile must go with it.
        processInstanceId: randomUUID(),
        name,
        sortOrder: 0,
        data: { phaseId: 'submissions' },
      }),
    ).rejects.toThrow();

    const leftover = await db.query.profiles.findMany({
      where: { name },
      columns: { id: true },
    });
    expect(leftover).toHaveLength(0);
  });
});

describe.concurrent('renamePhase', () => {
  it('writes the profile name and leaves the slug alone', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      processInstanceId: instanceId,
      name: `Before ${randomUUID()}`,
      sortOrder: 0,
      data: { phaseId: 'submissions' },
    });
    testData.trackProfileForCleanup(profile.id);

    const renamed = await renamePhase({ phaseId: phase.id, name: 'After' });

    expect(renamed.name).toBe('After');
    expect(renamed.slug).toBe(profile.slug);
  });

  it('throws NotFoundError for an unknown phase', async () => {
    await expect(
      renamePhase({ phaseId: randomUUID(), name: 'After' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe.concurrent('deletePhase', () => {
  it('deletes the profile and lets the cascade take the phase', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      processInstanceId: instanceId,
      name: `Doomed ${randomUUID()}`,
      sortOrder: 0,
      data: { phaseId: 'submissions' },
    });

    await deletePhase({ phaseId: phase.id });

    const remainingProfile = await db.query.profiles.findFirst({
      where: { id: profile.id },
      columns: { id: true },
    });
    const remainingPhase = await db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { id: true },
    });

    expect(remainingProfile).toBeUndefined();
    expect(remainingPhase).toBeUndefined();
  });

  it('throws NotFoundError for an unknown phase', async () => {
    await expect(deletePhase({ phaseId: randomUUID() })).rejects.toThrow(
      NotFoundError,
    );
  });
});

const setup = async (
  task: { id: string },
  onTestFinished: (fn: () => void | Promise<void>) => void,
) => {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const decisionSetup = await testData.createDecisionSetup({
    instanceCount: 1,
  });

  return { instanceId: decisionSetup.instance.instance.id, testData };
};
