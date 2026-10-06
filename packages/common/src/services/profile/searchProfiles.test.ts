import { TestProfileUserDataManager } from '@op/common/testing';
import { EntityType } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { searchProfiles } from './searchProfiles';

describe.concurrent('searchProfiles', () => {
  it('never returns a phase profile, even when asked for', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // One word unique to this test, shared by an org and a phase. The org
    // proves the word is searchable; the phase must still not come back.
    const word = `phasesearch${randomUUID().replace(/[^a-f]/g, '')}`;
    const [{ profile: org }, { profile: phase }] = await Promise.all([
      testData.createProfile({
        type: EntityType.ORG,
        profileName: word,
        users: { admin: 0 },
      }),
      testData.createProfile({
        type: EntityType.PHASE,
        profileName: word,
        users: { admin: 0 },
      }),
    ]);

    const groups = await searchProfiles({
      query: word,
      types: [EntityType.PHASE, EntityType.ORG],
    });

    expect(groups.map((group) => group.type)).toEqual([EntityType.ORG]);
    const ids = groups.flatMap((group) =>
      group.results.map((result) => result.id),
    );
    expect(ids).toContain(org.id);
    expect(ids).not.toContain(phase.id);
  });
});
