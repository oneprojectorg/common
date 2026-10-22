import { TestProfileUserDataManager } from '@op/common/testing';
import { EntityType } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { listProfiles } from './listProfiles';

describe.concurrent('listProfiles', () => {
  it('never returns a phase profile', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const [{ profile: org }, { profile: phase }] = await Promise.all([
      testData.createProfile({ type: EntityType.ORG, users: { admin: 0 } }),
      testData.createProfile({ type: EntityType.PHASE, users: { admin: 0 } }),
    ]);

    const [asked, unfiltered] = await Promise.all([
      listProfiles({ types: [EntityType.PHASE, EntityType.ORG], limit: 200 }),
      listProfiles({ orderBy: 'createdAt', limit: 200 }),
    ]);

    for (const { items } of [asked, unfiltered]) {
      const ids = items.map((profile) => profile.id);
      // The org proves this test's profiles are within the page.
      expect(ids).toContain(org.id);
      expect(ids).not.toContain(phase.id);
    }
  });
});
