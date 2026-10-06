import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { insertPhase } from './phaseHelpers';

describe.concurrent('insertPhase slug', () => {
  it('draws a new slug when the first one is taken', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData, taken } = await setup(task, onTestFinished);
    const fresh = randomUUID().slice(0, 8);
    const slugs = [taken, fresh];

    const { profile } = await db.transaction((tx) =>
      insertPhase({
        tx,
        processInstanceId: instanceId,
        name: 'Review',
        sortOrder: 0,
        data: { phaseId: 'review' },
        generateSlug: () => slugs.shift() ?? randomUUID().slice(0, 8),
      }),
    );
    testData.trackProfileForCleanup(profile.id);

    expect(profile.slug).toBe(fresh);
  });

  it('gives up after three taken slugs and writes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, taken } = await setup(task, onTestFinished);
    let attempts = 0;

    const name = `Unlucky ${randomUUID()}`;
    await expect(
      db.transaction((tx) =>
        insertPhase({
          tx,
          processInstanceId: instanceId,
          name,
          sortOrder: 0,
          data: { phaseId: 'review' },
          generateSlug: () => {
            attempts++;
            return taken;
          },
        }),
      ),
    ).rejects.toMatchObject({
      name: 'CommonError',
      message: 'Failed to create phase profile',
    });

    expect(attempts).toBe(3);
    const leftover = await db.query.profiles.findMany({
      where: { name },
      columns: { id: true },
    });
    expect(leftover).toHaveLength(0);
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

  const taken = randomUUID().slice(0, 8);
  const [occupier] = await db
    .insert(profiles)
    .values({ type: EntityType.PHASE, name: 'Occupier', slug: taken })
    .returning({ id: profiles.id });
  if (!occupier) {
    throw new Error('Failed to occupy a slug');
  }
  testData.trackProfileForCleanup(occupier.id);

  return {
    instanceId: decisionSetup.instance.instance.id,
    testData,
    taken,
  };
};
