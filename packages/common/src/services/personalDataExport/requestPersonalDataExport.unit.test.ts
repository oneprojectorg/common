import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
  setIfAbsentWithStatus: vi.fn(),
  setWithStatus: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertUserByAuthId: vi.fn(),
}));

import { getWithStatus, setIfAbsentWithStatus, setWithStatus } from '@op/cache';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';

import { assertUserByAuthId } from '../assert';
import { personalDataExportActiveKey } from './constants';
import { requestPersonalDataExport } from './requestPersonalDataExport';

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const sendEvent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setWithStatus).mockResolvedValue({ status: 'ok' });
  vi.mocked(setIfAbsentWithStatus).mockResolvedValue({ status: 'ok' });
  vi.mocked(getWithStatus).mockResolvedValue({ status: 'miss' });
  vi.spyOn(event, 'send').mockImplementation(sendEvent);
});

describe('requestPersonalDataExport request', () => {
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

  it('does not queue a job for an auth user with no account', async () => {
    vi.mocked(assertUserByAuthId).mockRejectedValueOnce(new Error('User'));

    await expect(requestPersonalDataExport({ user })).rejects.toThrow();

    expect(sendEvent).not.toHaveBeenCalled();
    expect(setWithStatus).not.toHaveBeenCalled();
  });

  it('does not queue a job when the record could not be written', async () => {
    vi.mocked(setWithStatus).mockResolvedValueOnce({ status: 'timeout' });

    await expect(requestPersonalDataExport({ user })).rejects.toThrow();

    expect(sendEvent).not.toHaveBeenCalled();
  });
});

describe('requestPersonalDataExport status record', () => {
  const seededRecord = (): Record<string, unknown> => {
    const [, record] = vi.mocked(setWithStatus).mock.calls[0] as [
      string,
      Record<string, unknown>,
      number,
    ];

    return record;
  };

  it('seeds a record the first status read can be answered from', async () => {
    const { exportId } = await requestPersonalDataExport({ user });

    expect(seededRecord()).toEqual({
      exportId,
      userId: AUTH_USER_ID,
      status: 'pending',
      createdAt: expect.any(String),
    });
  });

  it('seeds the record before it claims the slot, so a caller handed the id can read it', async () => {
    await requestPersonalDataExport({ user });

    const [seeded] = vi.mocked(setWithStatus).mock.invocationCallOrder;

    expect(seeded).toBeLessThan(
      Math.min(...vi.mocked(setIfAbsentWithStatus).mock.invocationCallOrder),
    );
  });

  it('records the subject the status read will check against', async () => {
    await requestPersonalDataExport({ user });

    expect(seededRecord().userId).toBe(AUTH_USER_ID);
  });

  it('files the record under the id it hands back', async () => {
    const { exportId } = await requestPersonalDataExport({ user });

    const [key] = vi.mocked(setWithStatus).mock.calls[0] as [
      string,
      ...unknown[],
    ];
    const [payload] = sendEvent.mock.calls[0] as [
      { data: { exportId: string } },
    ];

    expect(key).toContain(exportId);
    expect(payload.data.exportId).toBe(exportId);
  });
});

describe('requestPersonalDataExport while an export is running', () => {
  const RUNNING_ID = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    vi.mocked(setIfAbsentWithStatus).mockResolvedValue({ status: 'exists' });
  });

  it('returns the running export and queues nothing', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({
      status: 'hit',
      data: RUNNING_ID,
    });

    await expect(requestPersonalDataExport({ user })).resolves.toEqual({
      exportId: RUNNING_ID,
    });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['ended between the claim and the read', { status: 'miss' }, 'Try again'],
    [
      'cannot be read',
      { status: 'timeout' },
      'Could not read the running export',
    ],
    ['is not an id', { status: 'hit', data: 42 }, 'Try again'],
  ] as const)(
    'fails without queueing a job when the running export %s',
    async (_, holder, message) => {
      vi.mocked(getWithStatus).mockResolvedValue(holder);

      await expect(requestPersonalDataExport({ user })).rejects.toThrow(
        message,
      );

      expect(sendEvent).not.toHaveBeenCalled();
    },
  );

  it('fails without queueing a job when the claim could not be written', async () => {
    vi.mocked(setIfAbsentWithStatus).mockResolvedValue({ status: 'timeout' });

    await expect(requestPersonalDataExport({ user })).rejects.toThrow();

    expect(sendEvent).not.toHaveBeenCalled();
  });
});

describe('requestPersonalDataExport without Redis', () => {
  it('queues the job under its own id', async () => {
    vi.mocked(setIfAbsentWithStatus).mockResolvedValue({ status: 'disabled' });

    const { exportId } = await requestPersonalDataExport({ user });

    expect(sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ exportId }) }),
    );
  });
});

describe('requestPersonalDataExport when the job cannot be queued', () => {
  const activeKey = personalDataExportActiveKey(AUTH_USER_ID);

  beforeEach(() => {
    sendEvent.mockRejectedValueOnce(new Error('Inngest unavailable'));
  });

  it('releases its claim, so the next request can start an export', async () => {
    vi.mocked(getWithStatus).mockImplementation(async () => ({
      status: 'hit',
      data: vi.mocked(setIfAbsentWithStatus).mock.calls[0]?.[0].data,
    }));

    await expect(requestPersonalDataExport({ user })).rejects.toThrow(
      'Inngest unavailable',
    );

    expect(setIfAbsentWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ key: activeKey }),
    );
    expect(setWithStatus).toHaveBeenLastCalledWith(activeKey, null);
  });

  it('reports the send failure when the claim cannot be released', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({ status: 'timeout' });

    await expect(requestPersonalDataExport({ user })).rejects.toThrow(
      'Inngest unavailable',
    );
  });
});
