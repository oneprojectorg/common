import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: drive the reads, assert the funded/not-funded split and the
// skip rules. `eq` records (column, value) pairs so the tests can pin WHICH row
// each query addresses — the by-id lookups are the whole point of the module,
// and a chain that ignores its WHERE would hide a regression to "the latest".
vi.mock('@op/db/client', () => {
  const selections: { rows: Array<unknown> } = { rows: [] };
  const transitions: { rows: Array<unknown> } = { rows: [] };
  const authUserRows: { rows: Array<unknown> } = { rows: [] };
  const filters: Array<[unknown, unknown]> = [];

  // One builder per `select()`, keyed on the table it reads, so concurrent
  // queries can't hand each other the wrong rows.
  const rowsByTable: Record<string, { rows: Array<unknown> }> = {
    'selections.table': selections,
    'transitions.table': transitions,
    'auth_users.table': authUserRows,
  };

  const makeBuilder = () => {
    let table = '';
    const builder = {
      from: vi.fn((source: { __table?: string }) => {
        table = source.__table ?? '';
        return builder;
      }),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve(rowsByTable[table]?.rows ?? [])),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(rowsByTable[table]?.rows ?? []).then(resolve),
    };
    return builder;
  };

  return {
    db: {
      query: {
        decisionProcessResults: { findFirst: vi.fn() },
        processInstances: { findFirst: vi.fn() },
        proposals: { findMany: vi.fn() },
      },
      select: vi.fn(() => makeBuilder()),
      __selections: selections,
      __transitions: transitions,
      __authUsers: authUserRows,
      __filters: filters,
    },
    desc: vi.fn(),
    inArray: vi.fn((column: unknown, values: unknown) => {
      filters.push([column, values]);
      return { column, values };
    }),
    eq: vi.fn((column: unknown, value: unknown) => {
      filters.push([column, value]);
      return { column, value };
    }),
  };
});

// Distinct sentinels per column so a query filtering on the wrong one is
// visible in `__filters`.
vi.mock('@op/db/schema', () => ({
  authUsers: {
    __table: 'auth_users.table',
    id: 'auth_users.id',
    email: 'auth_users.email',
  },
  decisionProcessResultSelections: {
    __table: 'selections.table',
    processResultId: 'selections.process_result_id',
    proposalId: 'selections.proposal_id',
    allocated: 'selections.allocated',
  },
  stateTransitionHistory: {
    __table: 'transitions.table',
    id: 'transitions.id',
    processInstanceId: 'transitions.process_instance_id',
    transitionData: 'transitions.transition_data',
    transitionedAt: 'transitions.transitioned_at',
  },
}));

vi.mock('./getProposalsForPhase', () => ({
  getProposalIdsForPhase: vi.fn(),
}));

import { db } from '@op/db/client';

import { getProposalIdsForPhase } from './getProposalsForPhase';
import { listResultNotificationRecipients } from './listResultNotificationRecipients';

const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const RESULT_ID = '22222222-2222-4222-8222-222222222222';
const TRANSITION_ID = '33333333-3333-4333-8333-333333333333';
const PREVIOUS_PHASE_ID = 'review';

const MESSAGES = { funded: 'You were funded', notFunded: 'Not this round' };

// The mock module hangs the mutable query results off `db`; reach them through
// a typed accessor rather than re-declaring the mock's shape at every use.
const state = () =>
  db as unknown as {
    __selections: { rows: Array<unknown> };
    __transitions: { rows: Array<unknown> };
    __authUsers: { rows: Array<unknown> };
    __filters: Array<[unknown, unknown]>;
  };

const findResult = vi.mocked(db.query.decisionProcessResults.findFirst);
const findInstance = vi.mocked(db.query.processInstances.findFirst);
const findProposals = vi.mocked(db.query.proposals.findMany);
const mockPhaseIds = vi.mocked(getProposalIdsForPhase);

const proposal = ({
  id,
  title,
  profileId,
  profileUsers,
  budget = { amount: 12000, currency: 'USD' },
  deletedAt = null as string | null,
  moderationDetachedAt = null as string | null,
}: {
  id: string;
  title: string;
  profileId: string;
  profileUsers: Array<{
    authUserId: string;
    name: string | null;
    email: string | null;
  }>;
  budget?: unknown;
  deletedAt?: string | null;
  moderationDetachedAt?: string | null;
}) => ({
  id,
  profileId,
  deletedAt,
  moderationDetachedAt,
  proposalData: { budget },
  profile: { name: title, profileUsers },
});

const run = () =>
  listResultNotificationRecipients({
    processInstanceId: INSTANCE_ID,
    processResultId: RESULT_ID,
    transitionHistoryId: TRANSITION_ID,
    previousPhaseId: PREVIOUS_PHASE_ID,
  });

describe('listResultNotificationRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state().__filters.length = 0;
    state().__authUsers.rows = [];
    state().__selections.rows = [{ proposalId: 'funded-1', allocated: '8000' }];
    state().__transitions.rows = [
      {
        transitionData: { manualSelection: { resultNotifications: MESSAGES } },
      },
    ];
    findResult.mockResolvedValue({ id: RESULT_ID, success: true } as never);
    findInstance.mockResolvedValue({
      id: INSTANCE_ID,
      name: 'Participatory Budgeting 2026',
      instanceData: { phases: [] },
      currentStateId: 'voting',
      profile: { slug: 'pb-2026' },
    } as never);
    mockPhaseIds.mockResolvedValue(['funded-1', 'not-funded-1']);
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
        profileUsers: [
          { authUserId: 'auth-ada', name: 'Ada', email: 'ada@example.com' },
        ],
      }),
      proposal({
        id: 'not-funded-1',
        title: 'Bike Lane Study',
        profileId: 'profile-not-funded',
        profileUsers: [
          { authUserId: 'auth-bo', name: 'Bo', email: 'bo@example.com' },
        ],
        budget: { amount: 3000, currency: 'USD' },
      }),
    ] as never);
  });

  // The event carries both ids precisely so neither row is re-resolved as "the
  // latest" — a revert retires the result, and a later transition would hide
  // the copy. Pin the WHEREs, or that regression is invisible here.
  it('addresses the result row and the transition row by id', async () => {
    await run();

    expect(state().__filters).toContainEqual(['transitions.id', TRANSITION_ID]);
    expect(state().__filters).not.toContainEqual([
      'transitions.process_instance_id',
      INSTANCE_ID,
    ]);
    expect(state().__filters).toContainEqual([
      'selections.process_result_id',
      RESULT_ID,
    ]);
    expect(findResult).toHaveBeenCalledWith({
      where: { id: RESULT_ID, processInstanceId: INSTANCE_ID },
    });
  });

  // `profileUsers.email` is an insert-time snapshot nothing syncs; an author
  // who changed their address must hear about the outcome at the live one.
  it('prefers the live auth.users address over the profileUsers snapshot', async () => {
    state().__authUsers.rows = [
      { id: 'auth-ada', email: 'ada.new@example.com' },
    ];

    const result = await run();

    expect(result.ok && result.notification.recipients[0]?.email).toBe(
      'ada.new@example.com',
    );
    // Bo has no auth row in this fixture, so the snapshot still carries them.
    expect(result.ok && result.notification.recipients[1]?.email).toBe(
      'bo@example.com',
    );
  });

  it('splits the phase pool by the named result row', async () => {
    const result = await run();

    expect(result).toEqual({
      ok: true,
      notification: {
        processTitle: 'Participatory Budgeting 2026',
        processProfileSlug: 'pb-2026',
        messages: MESSAGES,
        recipients: [
          {
            email: 'ada@example.com',
            proposalProfileId: 'profile-funded',
            outcome: 'funded',
            values: {
              name: 'Ada',
              proposal: 'Community Garden Revamp',
              amount: '$8,000',
            },
          },
          {
            email: 'bo@example.com',
            proposalProfileId: 'profile-not-funded',
            outcome: 'notFunded',
            values: { name: 'Bo', proposal: 'Bike Lane Study', amount: '' },
          },
        ],
      },
    });
  });

  // The final phase's own window can produce a proposal the previous phase
  // never held. It is funded, so the result row has to be what decides.
  it('funds a selected proposal that was never in the candidate pool', async () => {
    state().__selections.rows = [
      { proposalId: 'funded-1', allocated: null },
      { proposalId: 'late-1', allocated: null },
    ];
    mockPhaseIds.mockResolvedValue(['funded-1']);
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
        profileUsers: [
          { authUserId: 'auth-ada', name: 'Ada', email: 'ada@example.com' },
        ],
      }),
      proposal({
        id: 'late-1',
        title: 'Late Entry',
        profileId: 'profile-late',
        profileUsers: [
          { authUserId: 'auth-cy', name: 'Cy', email: 'cy@example.com' },
        ],
        budget: { amount: 500, currency: 'USD' },
      }),
    ] as never);

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        recipients: [
          expect.objectContaining({ outcome: 'funded' }),
          // Funded, but with no allocation written, so `{{amount}}` resolves
          // to nothing rather than to what they asked for.
          expect.objectContaining({
            outcome: 'funded',
            values: expect.objectContaining({ amount: '' }),
          }),
        ],
      },
    });
  });

  it('mails every collaborator once, per proposal', async () => {
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
        profileUsers: [
          { authUserId: 'auth-ada', name: 'Ada', email: 'ada@example.com' },
          {
            authUserId: 'auth-ada-dup',
            name: 'Ada (dup)',
            email: 'ADA@example.com',
          },
          { authUserId: 'auth-bo', name: 'Bo', email: 'bo@example.com' },
          { authUserId: 'auth-anon', name: 'Anon', email: null },
        ],
      }),
    ] as never);
    mockPhaseIds.mockResolvedValue(['funded-1']);

    const result = await run();

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.notification.recipients).toEqual([
      expect.objectContaining({ email: 'ada@example.com' }),
      expect.objectContaining({ email: 'bo@example.com' }),
    ]);
  });

  it('skips a proposal that is no longer reachable', async () => {
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
        profileUsers: [
          { authUserId: 'auth-ada', name: 'Ada', email: 'ada@example.com' },
        ],
        moderationDetachedAt: '2026-01-01T00:00:00Z',
      }),
      proposal({
        id: 'not-funded-1',
        title: 'Bike Lane Study',
        profileId: 'profile-not-funded',
        profileUsers: [
          { authUserId: 'auth-bo', name: 'Bo', email: 'bo@example.com' },
        ],
        deletedAt: '2026-01-01T00:00:00Z',
      }),
    ] as never);

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });

  // A revert retires the row rather than deleting it. Re-resolving "the latest
  // successful result" here would find none and mail the whole pool.
  it('sends nothing once the result it announces has been retired', async () => {
    findResult.mockResolvedValue({ id: RESULT_ID, success: false } as never);

    await expect(run()).resolves.toEqual({
      ok: false,
      reason: 'resultRetired',
    });
  });

  // A half-written jsonb bag must not reach the renderer as `template:
  // undefined` and throw inside the send step.
  it.each([
    ['no admin composed them', { manualSelection: {} }],
    [
      'only one side was stamped',
      { manualSelection: { resultNotifications: { funded: 'Funded' } } },
    ],
    [
      'a side is blank',
      {
        manualSelection: {
          resultNotifications: { funded: 'Funded', notFunded: '   ' },
        },
      },
    ],
  ])('sends nothing when %s', async (_label, transitionData) => {
    state().__transitions.rows = [{ transitionData }];

    await expect(run()).resolves.toEqual({
      ok: false,
      reason: 'messagesMissing',
    });
  });

  it('sends nothing when no author has a usable address', async () => {
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
        profileUsers: [{ authUserId: 'auth-anon', name: 'Anon', email: null }],
      }),
    ] as never);
    mockPhaseIds.mockResolvedValue(['funded-1']);

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });
});
