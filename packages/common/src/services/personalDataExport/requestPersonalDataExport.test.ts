import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: requestPersonalDataExport is orchestration over an account
// lookup, the status cache, and the event bus. We drive those and assert what it
// hands onward — the job it asks for, and the record the first status read will
// find.
vi.mock('@op/cache', () => ({
  set: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertUserByAuthId: vi.fn(),
}));

import { set } from '@op/cache';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';

import { assertUserByAuthId } from '../assert';
import { requestPersonalDataExport } from './requestPersonalDataExport';

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const sendEvent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(event, 'send').mockImplementation(sendEvent);
});

describe('requestPersonalDataExport request', () => {
  // The subject is the caller and nothing else. The payload is asserted whole
  // rather than by naming keys that should be absent: a subject id put back by
  // way of a spread adds a key nobody thought to write a test for, and only an
  // exact match notices that. Article 20 makes that the difference between an
  // export and a data breach.
  it('tells the job which subject and nothing else', async () => {
    const { exportId } = await requestPersonalDataExport({ user });

    const [payload] = sendEvent.mock.calls[0] as [
      { name: string; data: Record<string, unknown> },
    ];

    expect(payload.name).toBe(Events.personalDataExportRequested.name);
    expect(payload.data).toEqual({
      exportId,
      userId: AUTH_USER_ID,
    });
  });

  // A background job's only report is the export record, so an auth user with no
  // account row would surface as a failed export rather than as the missing
  // account it is. This fails where the caller can see it.
  it('does not queue a job for an auth user with no account', async () => {
    vi.mocked(assertUserByAuthId).mockRejectedValueOnce(new Error('User'));

    await expect(requestPersonalDataExport({ user })).rejects.toThrow();

    expect(sendEvent).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('requestPersonalDataExport status record', () => {
  const seededRecord = (): Record<string, unknown> => {
    const [, record] = vi.mocked(set).mock.calls[0] as [
      string,
      Record<string, unknown>,
      number,
    ];

    return record;
  };

  // The first status read almost always lands while the export is still
  // pending, so a record seeded without the fields the status contract requires
  // fails validation on the most common read of all — reported to the subject as
  // a broken export rather than one that has not started yet.
  it('seeds a record the first status read can be answered from', async () => {
    const { exportId } = await requestPersonalDataExport({ user });

    expect(seededRecord()).toEqual({
      exportId,
      userId: AUTH_USER_ID,
      status: 'pending',
      createdAt: expect.any(String),
    });
  });

  // `userId` is the whole ownership check on every later read. A record seeded
  // without it parses as malformed and the export becomes unreadable; a record
  // seeded with the wrong one hands the file to someone else.
  it('records the subject the status read will check against', async () => {
    await requestPersonalDataExport({ user });

    expect(seededRecord().userId).toBe(AUTH_USER_ID);
  });

  // Three ids have to agree: the one handed back to the client, the key the
  // record is filed under, and the one the job is told to update. Were they to
  // diverge the client would read a record nothing ever writes to, and wait out
  // its timeout on an export that succeeded.
  it('files the record under the id it hands back', async () => {
    const { exportId } = await requestPersonalDataExport({ user });

    const [key] = vi.mocked(set).mock.calls[0] as [string, ...unknown[]];
    const [payload] = sendEvent.mock.calls[0] as [
      { data: { exportId: string } },
    ];

    expect(key).toContain(exportId);
    expect(payload.data.exportId).toBe(exportId);
  });
});
