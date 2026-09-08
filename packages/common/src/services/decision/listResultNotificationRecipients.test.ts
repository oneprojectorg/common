import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: drive the reads, assert the funded/not-funded split and the
// skip rules. `eq` records (column, value) pairs so the tests can pin WHICH row
// each query addresses — the by-id lookups are the whole point of the module,
// and a chain that ignores its WHERE would hide a regression to "the latest".
vi.mock('@op/db/client', () => {
  const selections: { rows: Array<unknown> } = { rows: [] };
  const transitions: { rows: Array<unknown> } = { rows: [] };
  const nameRows: { rows: Array<unknown> } = { rows: [] };
  const filters: Array<[unknown, unknown]> = [];

  // One builder per `select()`, keyed on the table it reads, so concurrent
  // queries can't hand each other the wrong rows.
  const rowsByTable: Record<string, { rows: Array<unknown> }> = {
    'selections.table': selections,
    'transitions.table': transitions,
    'users.table': nameRows,
  };

  const makeBuilder = () => {
    let table = '';
    const builder = {
      from: vi.fn((source: { __table?: string }) => {
        table = source.__table ?? '';
        return builder;
      }),
      innerJoin: vi.fn(() => builder),
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
      __names: nameRows,
      __filters: filters,
    },
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
  profiles: {
    id: 'profiles.id',
    name: 'profiles.name',
    email: 'profiles.email',
  },
  users: {
    __table: 'users.table',
    authUserId: 'users.auth_user_id',
    profileId: 'users.profile_id',
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

vi.mock('../email/recipients', () => ({
  listMemberProfileRecipients: vi.fn(),
}));

vi.mock('./getProposalsForPhase', () => ({
  getProposalIdsForPhase: vi.fn(),
}));

import { db } from '@op/db/client';

import {
  type EmailRecipient,
  listMemberProfileRecipients,
} from '../email/recipients';
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
    __names: { rows: Array<unknown> };
    __filters: Array<[unknown, unknown]>;
  };

const findResult = vi.mocked(db.query.decisionProcessResults.findFirst);
const findInstance = vi.mocked(db.query.processInstances.findFirst);
const findProposals = vi.mocked(db.query.proposals.findMany);
const mockPhaseIds = vi.mocked(getProposalIdsForPhase);
const mockAudienceOf = vi.mocked(listMemberProfileRecipients);

const ADA: EmailRecipient = {
  authUserId: 'auth-ada',
  email: 'ada@example.com',
};
const BO: EmailRecipient = { authUserId: 'auth-bo', email: 'bo@example.com' };

const proposal = ({
  id,
  title,
  profileId,
  budget = { amount: 12000, currency: 'USD' },
  deletedAt = null as string | null,
  moderationDetachedAt = null as string | null,
}: {
  id: string;
  title: string;
  profileId: string;
  budget?: unknown;
  deletedAt?: string | null;
  moderationDetachedAt?: string | null;
}) => ({
  id,
  profileId,
  deletedAt,
  moderationDetachedAt,
  proposalData: { budget },
  profile: { name: title },
});

/** Routes each proposal profile to its own audience, as the resolver does. */
const audienceByProfile = (map: Record<string, Array<EmailRecipient>>) =>
  mockAudienceOf.mockImplementation(async (profileId) => map[profileId] ?? []);

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
    state().__names.rows = [
      { authUserId: 'auth-ada', name: 'Ada' },
      { authUserId: 'auth-bo', name: 'Bo' },
    ];
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
      }),
      proposal({
        id: 'not-funded-1',
        title: 'Bike Lane Study',
        profileId: 'profile-not-funded',
        budget: { amount: 3000, currency: 'USD' },
      }),
    ] as never);
    audienceByProfile({
      'profile-funded': [ADA],
      'profile-not-funded': [BO],
    });
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

  // Delivery is the shared resolver's job — it is the one place that knows
  // addresses come from `auth.users`, so this send must not resolve its own.
  it('asks the shared resolver for each proposal profile audience', async () => {
    await run();

    expect(mockAudienceOf).toHaveBeenCalledWith('profile-funded');
    expect(mockAudienceOf).toHaveBeenCalledWith('profile-not-funded');
    expect(mockAudienceOf).toHaveBeenCalledTimes(2);
  });

  // Structural, because fixtures alone can't prove a column goes unread: the
  // only query this module runs against the author is for the display name.
  it('never reads an address of its own', async () => {
    await run();

    const nameSelect = vi
      .mocked(db.select)
      .mock.calls.map(([columns]) => Object.values(columns ?? {}))
      .find((columns) => columns.includes('profiles.name'));

    expect(nameSelect).toEqual(['users.auth_user_id', 'profiles.name']);
    expect(nameSelect).not.toContain('profiles.email');
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
    state().__names.rows = [
      ...state().__names.rows,
      { authUserId: 'auth-cy', name: 'Cy' },
    ];
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
      }),
      proposal({
        id: 'late-1',
        title: 'Late Entry',
        profileId: 'profile-late',
        budget: { amount: 500, currency: 'USD' },
      }),
    ] as never);
    audienceByProfile({
      'profile-funded': [ADA],
      'profile-late': [{ authUserId: 'auth-cy', email: 'cy@example.com' }],
    });

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
    mockPhaseIds.mockResolvedValue(['funded-1']);
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
      }),
    ] as never);
    // Two accounts landing in one inbox in different case, plus an anonymous
    // account the resolver reports with no address at all.
    audienceByProfile({
      'profile-funded': [
        ADA,
        { authUserId: 'auth-ada-dup', email: 'ADA@example.com' },
        BO,
        { authUserId: 'auth-anon', email: null },
      ],
    });
    state().__names.rows = [
      ...state().__names.rows,
      { authUserId: 'auth-ada-dup', name: 'Ada' },
      { authUserId: 'auth-anon', name: 'Anon' },
    ];

    const result = await run();

    expect(result.ok && result.notification.recipients).toEqual([
      expect.objectContaining({ email: 'ada@example.com' }),
      expect.objectContaining({ email: 'bo@example.com' }),
    ]);
  });

  it('skips an author with no profile to take a name from', async () => {
    state().__names.rows = [{ authUserId: 'auth-ada', name: 'Ada' }];

    const result = await run();

    expect(result.ok && result.notification.recipients).toEqual([
      expect.objectContaining({ email: 'ada@example.com' }),
    ]);
  });

  it('skips a proposal that is no longer reachable', async () => {
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
        moderationDetachedAt: '2026-01-01T00:00:00Z',
      }),
      proposal({
        id: 'not-funded-1',
        title: 'Bike Lane Study',
        profileId: 'profile-not-funded',
        deletedAt: '2026-01-01T00:00:00Z',
      }),
    ] as never);

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
    // A takedown must not even be looked up, let alone mailed.
    expect(mockAudienceOf).not.toHaveBeenCalled();
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
    mockPhaseIds.mockResolvedValue(['funded-1']);
    findProposals.mockResolvedValue([
      proposal({
        id: 'funded-1',
        title: 'Community Garden Revamp',
        profileId: 'profile-funded',
      }),
    ] as never);
    audienceByProfile({
      'profile-funded': [{ authUserId: 'auth-anon', email: null }],
    });

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });
});
