import {
  NotFoundError,
  createPhase,
  decisionPermission,
  deletePhase,
  renamePhase,
} from '@op/common';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';
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

  it('mints one profile-scoped role per requested capability', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { profile, roles } = await createPhase({
      processInstanceId: instanceId,
      name: 'Review',
      sortOrder: 0,
      data: { phaseId: 'review' },
      capabilities: ['review', 'vote'],
    });
    testData.trackProfileForCleanup(profile.id);

    expect(roles.map((role) => role.capability).sort()).toEqual([
      'review',
      'vote',
    ]);

    const stored = await db.query.accessRoles.findMany({
      where: { profileId: profile.id },
      columns: { id: true, name: true },
    });
    expect(stored.map((role) => role.name).sort()).toEqual([
      'Reviewer',
      'Voter',
    ]);
  });

  it('gives a capability role its own bit plus READ, and no admin', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { profile, roles } = await createPhase({
      processInstanceId: instanceId,
      name: 'Submissions',
      sortOrder: 0,
      data: { phaseId: 'submissions' },
      capabilities: ['submit'],
    });
    testData.trackProfileForCleanup(profile.id);

    const roleId = roles[0]?.roleId;
    expect(roleId).toBeDefined();

    const zones = await db.query.accessRolePermissionsOnAccessZones.findMany({
      where: { accessRoleId: roleId },
      with: { accessZone: { columns: { name: true } } },
    });

    const decisions = zones.find((row) => row.accessZone.name === 'decisions');
    const profileZone = zones.find((row) => row.accessZone.name === 'profile');

    const decisionBits = decisions?.permission ?? 0;
    expect(decisionBits & decisionPermission.SUBMIT_PROPOSALS).not.toBe(0);
    expect(decisionBits & permission.READ).not.toBe(0);
    // The other capabilities, and manage, stay off.
    expect(decisionBits & decisionPermission.REVIEW).toBe(0);
    expect(decisionBits & decisionPermission.VOTE).toBe(0);
    expect(decisionBits & permission.ADMIN).toBe(0);
    // createDecisionRole force-adds profile READ.
    expect((profileZone?.permission ?? 0) & permission.READ).not.toBe(0);
  });

  it('creates no roles when no capability is offered', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await setup(task, onTestFinished);

    const { profile, roles } = await createPhase({
      processInstanceId: instanceId,
      name: 'Closed',
      sortOrder: 0,
      data: { phaseId: 'closed' },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(roles).toEqual([]);
    const stored = await db.query.accessRoles.findMany({
      where: { profileId: profile.id },
      columns: { id: true },
    });
    expect(stored).toHaveLength(0);
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
      capabilities: ['submit'],
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
