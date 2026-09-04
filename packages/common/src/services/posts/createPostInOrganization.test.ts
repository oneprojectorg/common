import { db } from '@op/db/client';
import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrgAccessUser } from '../';
import { createPostInOrganization } from './createPostInOrganization';

// `server-only` can't load under Vitest; stub the modules that would pull it
// in. Only the surface this test exercises is wired up.
vi.mock('@op/db/client', () => ({
  db: {
    insert: vi.fn(),
    _query: { objectsInStorage: { findMany: vi.fn() } },
    transaction: vi.fn(),
  },
}));

vi.mock('@op/db/schema', () => ({
  attachments: { _: 'attachments' },
  posts: { _: 'posts' },
  postsToOrganizations: { _: 'postsToOrganizations' },
}));

vi.mock('../', () => ({
  getOrgAccessUser: vi.fn(),
}));

const mockTransaction = vi.mocked(db.transaction);
const mockPoolInsert = vi.mocked(db.insert);
const mockPoolStorageFindMany = vi.mocked(db._query.objectsInStorage.findMany);
const mockGetOrgAccessUser = vi.mocked(getOrgAccessUser);

const ORGANIZATION_ID = 'org-1';
const ATTACHMENT_ID = 'storage-object-1';

const input = {
  id: ORGANIZATION_ID,
  content: 'hello',
  attachmentIds: [ATTACHMENT_ID],
  user: { id: 'auth-user-1' } as never,
};

/**
 * A transaction handle that records every `insert(...).values(...)` against it
 * and serves the storage lookup the service does before writing.
 */
const recordingTx = (writes: Array<{ table: unknown; values: unknown }>) => ({
  _query: {
    objectsInStorage: {
      findMany: async () => [
        {
          id: ATTACHMENT_ID,
          name: 'orgs/1234_report.pdf',
          metadata: { mimetype: 'application/pdf' },
        },
      ],
    },
  },
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

describe('createPostInOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgAccessUser.mockResolvedValue({ id: 'org-user-1' } as never);
  });

  it('reads storage objects and writes all three tables on one transaction handle', async () => {
    const writes: Array<{ table: unknown; values: unknown }> = [];
    mockTransaction.mockImplementation((async (
      cb: (tx: unknown) => Promise<unknown>,
    ) => cb(recordingTx(writes))) as never);

    const result = await createPostInOrganization(input);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(writes.map((write) => write.table)).toEqual([
      posts,
      postsToOrganizations,
      attachments,
    ]);
    // A partial write here leaves a post with no owning org, or uploads that
    // were never linked — nothing may escape to the pool.
    expect(mockPoolInsert).not.toHaveBeenCalled();
    expect(mockPoolStorageFindMany).not.toHaveBeenCalled();
    // The storage rows the caller gets back are the ones the attachment rows
    // were built from, read in the same transaction.
    expect(result.allStorageObjects).toHaveLength(1);
  });

  it('runs in the caller-supplied client instead of the pool', async () => {
    const callerTransaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb(recordingTx([])),
    );

    await createPostInOrganization({
      ...input,
      db: { transaction: callerTransaction } as never,
    });

    expect(callerTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
