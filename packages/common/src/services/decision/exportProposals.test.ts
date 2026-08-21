import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: exportProposals is orchestration over an instance lookup, the
// admin gate, the durable export record, and the event bus. We drive those and
// assert what it hands onward — the job it asks for, and the record the first
// status read will find.
vi.mock('@op/db/client', () => ({
  db: {
    query: { processInstances: { findFirst: vi.fn() } },
    insert: vi.fn(),
  },
}));

vi.mock('../assert', () => ({
  assertProfileAccess: vi.fn(),
}));

import { db } from '@op/db/client';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';

import { exportProposals } from './exportProposals';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const EXPORT_ID = '55555555-5555-4555-8555-555555555555';

const user = { id: AUTH_USER_ID } as User;

const sendEvent = vi.fn();
const insertValues = vi.fn(() => ({
  returning: async () => [{ id: EXPORT_ID }],
}));

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(db.query.processInstances.findFirst).mockResolvedValue({
    profileId: PROFILE_ID,
  } as never);

  vi.mocked(db.insert).mockReturnValue({
    values: insertValues,
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
  // an admin could not ask for anything wider than their own view. Nothing
  // about that view may reach the job now — what an export covers is settled
  // by the job itself.
  //
  // The payload is asserted whole rather than by naming keys that should be
  // absent: a filter put back by way of a spread adds a key nobody thought to
  // write a test for, and only an exact match notices that.
  it('tells the job which instance and nothing about the caller', async () => {
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

  it('returns the id the durable record was created under', async () => {
    const { exportId } = await requestExport();

    expect(exportId).toBe(EXPORT_ID);
  });
});

describe('exportProposals status record', () => {
  // The row's id becomes the exportId the job is told to update and the id the
  // client is handed back, so the three have to agree — were they to diverge
  // the client would poll a record nothing ever writes to, and wait out its
  // timeout on an export that succeeded.
  it('files the job under the id the record was created with', async () => {
    const { exportId } = await requestExport();

    const [payload] = sendEvent.mock.calls[0] as [
      { data: { exportId: string } },
    ];

    expect(exportId).toBe(EXPORT_ID);
    expect(payload.data.exportId).toBe(EXPORT_ID);
  });

  it('inserts a record scoped to the instance and the requesting caller', async () => {
    await requestExport();

    expect(insertValues).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      requestedByUserId: AUTH_USER_ID,
      format: 'csv',
    });
  });
});
