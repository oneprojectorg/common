import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
  setWithStatus: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertUserByAuthId: vi.fn(),
}));

import { getWithStatus, setWithStatus } from '@op/cache';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';

import { assertUserByAuthId } from '../assert';
import { requestPersonalDataExport } from './requestPersonalDataExport';

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const sendEvent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setWithStatus).mockResolvedValue({ status: 'ok' });
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

  const stubLatest = (record: Record<string, unknown>) => {
    vi.mocked(getWithStatus).mockImplementation(async (key) =>
      key.includes('active')
        ? { status: 'hit', data: RUNNING_ID }
        : { status: 'hit', data: record },
    );
  };

  const running = (overrides: Record<string, unknown> = {}) => ({
    exportId: RUNNING_ID,
    userId: AUTH_USER_ID,
    status: 'processing',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('returns the running export and queues nothing', async () => {
    stubLatest(running());

    await expect(requestPersonalDataExport({ user })).resolves.toEqual({
      exportId: RUNNING_ID,
    });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['finished', { status: 'completed' }],
    ['failed', { status: 'failed' }],
    [
      'stuck past the wait cap',
      { createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString() },
    ],
  ])('starts a new export when the latest one is %s', async (_, overrides) => {
    stubLatest(running(overrides));

    const { exportId } = await requestPersonalDataExport({ user });

    expect(exportId).not.toBe(RUNNING_ID);
    expect(sendEvent).toHaveBeenCalledTimes(1);
  });
});
