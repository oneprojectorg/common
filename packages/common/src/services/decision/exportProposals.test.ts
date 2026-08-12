import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: exportProposals is orchestration over an instance lookup, the
// admin gate, the status cache, and the event bus. We drive those and assert
// what it hands onward — the filters the job will run under, and the record the
// first status read will find.
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
import { ProposalStatus } from '@op/db/schema';
import { Events, event, proposalExportFiltersSchema } from '@op/events';
import type { User } from '@op/supabase/lib';

import { exportProposals } from './exportProposals';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

/**
 * Every filter the proposals list can resolve to, set to a distinct value so a
 * dropped one shows up as a missing key rather than as a coincidental match
 * with its neighbour.
 */
const allFilters = {
  categoryId: 'category-1',
  submittedByProfileId: 'submitter-1',
  votedByProfileId: 'voter-1',
  status: ProposalStatus.SUBMITTED,
  dir: 'asc',
  phase: 'results',
  excludeAssignedForReview: true,
} as const;

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

/** The filters carried by the event the workflow will consume. */
const requestedFilters = async (
  overrides: Partial<typeof allFilters> = {},
): Promise<Record<string, unknown>> => {
  await exportProposals({
    input: {
      processInstanceId: INSTANCE_ID,
      format: 'csv',
      ...allFilters,
      ...overrides,
    },
    user,
  });

  const [payload] = sendEvent.mock.calls[0] as [
    { name: string; data: { filters: Record<string, unknown> } },
  ];

  expect(payload.name).toBe(Events.proposalExportRequested.name);

  return payload.data.filters;
};

describe('exportProposals filter forwarding', () => {
  // The regression this pins: three of the list's filters were never forwarded,
  // so an admin who had narrowed to their ballot, a phase, or the proposals they
  // were not reviewing received a CSV of the whole instance instead. A
  // too-large export is indistinguishable from a correct one, so nothing
  // surfaced it.
  it('asks the job to run under every filter the list resolved to', async () => {
    await expect(requestedFilters()).resolves.toEqual(allFilters);
  });

  // Each of these was dropped individually before the fix, and each on its own
  // widens the file past what the admin was looking at.
  it.each([
    ['votedByProfileId', 'voter-1'],
    ['phase', 'results'],
    ['excludeAssignedForReview', true],
  ])('forwards %s, which a filtered list depends on', async (key, value) => {
    const filters = await requestedFilters();

    expect(filters[key]).toBe(value);
  });

  // A filter the list query cannot apply used to travel the whole way here and
  // then be ignored, which read as a supported feature at every layer it passed
  // through. Anything the job cannot honour must not appear to have been asked
  // for.
  it('carries nothing the proposals query would not accept', async () => {
    const filters = await requestedFilters();

    expect(
      proposalExportFiltersSchema.strict().safeParse(filters).success,
    ).toBe(true);
  });

  it('omits filters the admin did not apply rather than inventing values', async () => {
    await exportProposals({
      input: { processInstanceId: INSTANCE_ID, format: 'csv', dir: 'desc' },
      user,
    });

    const [payload] = sendEvent.mock.calls[0] as [
      { data: { filters: Record<string, unknown> } },
    ];

    expect(payload.data.filters.categoryId).toBeUndefined();
    expect(payload.data.filters.votedByProfileId).toBeUndefined();
    expect(payload.data.filters.dir).toBe('desc');
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
    await exportProposals({
      input: { processInstanceId: INSTANCE_ID, format: 'csv', ...allFilters },
      user,
    });

    expect(seededRecord()).toMatchObject({
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      format: 'csv',
      status: 'pending',
    });
    expect(seededRecord().createdAt).toEqual(expect.any(String));
  });

  it('records the same filters the job was asked for', async () => {
    const filters = await requestedFilters();

    expect(seededRecord().filters).toEqual(filters);
  });

  it('records filters that satisfy the shape the status response promises', async () => {
    await exportProposals({
      input: { processInstanceId: INSTANCE_ID, format: 'csv', ...allFilters },
      user,
    });

    expect(
      proposalExportFiltersSchema.safeParse(seededRecord().filters).success,
    ).toBe(true);
  });
});
