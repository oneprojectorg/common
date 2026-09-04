import { db } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentProfileId } from '../access';
import { createPostOnProfile } from './createPostOnProfile';

// `server-only` can't load under Vitest; stub the modules that would pull it
// in. Only the surface this test exercises is wired up.
vi.mock('@op/db/client', () => ({
  db: {
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@op/db/schema', () => ({
  posts: { _: 'posts' },
  postsToProfiles: { _: 'postsToProfiles' },
}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('../access', () => ({
  getCurrentProfileId: vi.fn(),
}));

const mockTransaction = vi.mocked(db.transaction);
const mockPoolInsert = vi.mocked(db.insert);
const mockGetCurrentProfileId = vi.mocked(getCurrentProfileId);

const AUTHOR_PROFILE_ID = 'author-profile-1';
const TARGET_PROFILE_ID = 'target-profile-1';

const input = {
  content: 'hello',
  targetProfileId: TARGET_PROFILE_ID,
  authUserId: 'auth-user-1',
};

/**
 * A transaction handle that records every `insert(...).values(...)` against it.
 * `values()` is both awaitable and `.returning()`-able, matching the two call
 * shapes the service uses.
 */
const recordingTx = (writes: Array<{ table: unknown; values: unknown }>) => ({
  insert: (table: unknown) => ({
    values: (values: unknown) => {
      writes.push({ table, values });
      const rows = [{ id: 'post-1' }];
      return Object.assign(Promise.resolve(rows), {
        returning: async () => rows,
      });
    },
  }),
});

describe('createPostOnProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentProfileId.mockResolvedValue(AUTHOR_PROFILE_ID as never);
  });

  it('writes the post and its profile association on one transaction handle', async () => {
    const writes: Array<{ table: unknown; values: unknown }> = [];
    mockTransaction.mockImplementation((async (
      cb: (tx: unknown) => Promise<unknown>,
    ) => cb(recordingTx(writes))) as never);

    await createPostOnProfile(input);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(writes.map((write) => write.table)).toEqual([
      posts,
      postsToProfiles,
    ]);
    // A partial write here would orphan the post, so neither statement may
    // escape to the pool.
    expect(mockPoolInsert).not.toHaveBeenCalled();
  });

  it('runs in the caller-supplied client instead of the pool', async () => {
    const callerTransaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb(recordingTx([])),
    );

    await createPostOnProfile({
      ...input,
      db: { transaction: callerTransaction } as never,
    });

    expect(callerTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
