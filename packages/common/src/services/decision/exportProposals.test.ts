import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: exportProposals is orchestration over an instance lookup, the
// admin gate, the status cache, and the event bus. We drive those and assert
// what it hands onward — the job it asks for, and the record the first status
// read will find.
vi.mock('@op/cache', () => ({
  set: vi.fn(),
}));

vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertProfileAccess: vi.fn(),
}));

import { set } from '@op/cache';
import { db } from '@op/db/client';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';

import { exportProposals } from './exportProposals';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const sendEvent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{ profileId: PROFILE_ID }],
      }),
    }),
  } as never);

  vi.spyOn(event, 'send').mockImplementation(sendEvent);
});

const requestExport = () =>
  exportProposals({
    input: { processInstanceId: INSTANCE_ID, format: 'csv' },
    user,
  });

describe('exportProposals request', () => {
  // An export used to inherit whatever the list had been narrowed to, so one
  // button produced different files from state the CSV itself cannot show, and
  // an admin could not ask for the whole instance at all. Nothing about the
  // caller's view may reach the job now.
  //
  // The payload is asserted whole rather than by naming keys that should be
  // absent: a filter put back by way of a spread adds a key nobody thought to
  // write a test for, and only an exact match notices that.
  it('asks the job for the instance and nothing about the caller', async () => {
    const { exportId } = await requestExport();

    const [payload] = sendEvent.mock.calls[0] as [
      { name: string; data: Record<string, unknown> },
    ];

    expect(payload.name).toBe(Events.proposalExportRequested.name);
    expect(payload.data).toEqual({
      exportId,
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      format: 'csv',
    });
  });
});

describe('exportProposals status record', () => {
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
  // fails validation on the most common read of all — reported to the admin as
  // a broken export rather than one that has not started yet.
  it('seeds a record the first status read can be answered from', async () => {
    const { exportId } = await requestExport();

    expect(seededRecord()).toEqual({
      exportId,
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      format: 'csv',
      status: 'pending',
      createdAt: expect.any(String),
    });
  });

  // Three ids have to agree: the one handed back to the client, the key the
  // record is filed under, and the one the job is told to update. Were they to
  // diverge the client would read a record nothing ever writes to, and wait out
  // its timeout on an export that succeeded.
  it('files the record under the id it hands back', async () => {
    const { exportId } = await requestExport();

    const [key] = vi.mocked(set).mock.calls[0] as [string, ...unknown[]];
    const [payload] = sendEvent.mock.calls[0] as [
      { data: { exportId: string } },
    ];

    expect(key).toContain(exportId);
    expect(payload.data.exportId).toBe(exportId);
  });
});
