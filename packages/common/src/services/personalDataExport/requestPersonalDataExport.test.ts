import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  // Asserted whole rather than by naming absent keys: a subject id put back by
  // way of a spread is the difference between an export and a data breach.
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

  // Otherwise a missing account surfaces as a failed export rather than as the
  // missing account it is.
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

  // The first status read almost always lands while the run is still pending, so
  // an incomplete seed fails the most common read of all.
  it('seeds a record the first status read can be answered from', async () => {
    const { exportId } = await requestPersonalDataExport({ user });

    expect(seededRecord()).toEqual({
      exportId,
      userId: AUTH_USER_ID,
      status: 'pending',
      createdAt: expect.any(String),
    });
  });

  // `userId` is the whole ownership check on every later read.
  it('records the subject the status read will check against', async () => {
    await requestPersonalDataExport({ user });

    expect(seededRecord().userId).toBe(AUTH_USER_ID);
  });

  // Diverge these and the client waits out its timeout on an export that
  // succeeded, reading a record nothing ever writes to.
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
