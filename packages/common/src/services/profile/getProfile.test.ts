import { TestProfileUserDataManager } from '@op/common/testing';
import { EntityType } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../utils';
import { getProfile } from './getProfile';

describe.concurrent('getProfile', () => {
  it('resolves a profile by its slug', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile } = await testData.createProfile({
      type: EntityType.ORG,
    });

    const result = await getProfile({ slug: profile.slug });

    expect(result.id).toBe(profile.id);
  });

  it('treats a phase profile slug as not found', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile } = await testData.createProfile({
      type: EntityType.PHASE,
    });

    await expect(getProfile({ slug: profile.slug })).rejects.toThrow(
      NotFoundError,
    );
  });
});
