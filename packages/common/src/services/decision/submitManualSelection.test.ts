import { db } from '@op/db/client';
import { event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { processResults } from './processResults';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import { submitManualSelection } from './submitManualSelection';

// Unit test: drives submitManualSelection through a review-enabled phase and
// asserts review-assignment generation is invoked with the transition's data
// AFTER the transaction commits. The commit ordering is the regression guard —
// generateReviewAssignments reads the just-attached proposals on the pooled
// connection, so it must run after commit, not inside the transaction.

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      processInstances: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  },
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('@op/db/schema', () => ({
  ProcessStatus: { PUBLISHED: 'published' },
  decisionTransitionProposals: {},
  processInstances: {},
  proposalHistory: {},
  stateTransitionHistory: {},
}));

vi.mock('@op/events', () => ({
  Events: {
    manualSelectionsConfirmed: { name: 'manualSelectionsConfirmed' },
    decisionResultsNotified: { name: 'decisionResultsNotified' },
  },
  event: { send: vi.fn(() => Promise.resolve()) },
}));

vi.mock('access-zones', () => ({
  permission: { ADMIN: 4 },
}));

vi.mock('../assert', () => ({
  assertUserByAuthId: vi.fn(),
  assertProfileAccess: vi.fn(),
}));

vi.mock('./getProposalsForPhase', () => ({
  getProposalIdsForPhase: vi.fn(),
}));

vi.mock('./processResults', () => ({
  processResults: vi.fn(),
}));

vi.mock('./runGenerateReviewAssignments', () => ({
  runGenerateReviewAssignments: vi.fn(() => Promise.resolve()),
}));

const mockFindFirst = vi.mocked(db.query.processInstances.findFirst);
const mockTransaction = vi.mocked(db.transaction);
const mockAssertUserByAuthId = vi.mocked(assertUserByAuthId);
const mockAssertProfileAccess = vi.mocked(assertProfileAccess);
const mockGetProposalIdsForPhase = vi.mocked(getProposalIdsForPhase);
const mockProcessResults = vi.mocked(processResults);
const mockRunGenerateReviewAssignments = vi.mocked(
  runGenerateReviewAssignments,
);

const AUTH_USER_ID = 'auth-1';
const USER_PROFILE_ID = 'user-profile-1';
const DECISION_PROFILE_ID = 'profile-1';
const INSTANCE_ID = 'instance-1';
const PREVIOUS_PHASE_ID = 'phase-1';
const CURRENT_PHASE_ID = 'phase-2';
const TRANSITION_HISTORY_ID = 'trans-1';

const user = { id: AUTH_USER_ID } as unknown as User;

/**
 * instanceData with three phases so the current phase (index 1) has a previous
 * phase (manual selection requires one) and is NOT the last phase (keeps
 * processResults out of the transaction). The current phase enables reviews.
 */
function instanceData(review: boolean) {
  return {
    phases: [
      { phaseId: PREVIOUS_PHASE_ID, name: 'Submission', rules: {} },
      {
        phaseId: CURRENT_PHASE_ID,
        name: 'Review',
        rules: { proposals: { review } },
      },
      { phaseId: 'phase-3', name: 'Voting', rules: {} },
    ],
    config: { reviewsPolicy: 'full_coverage' },
  };
}

/**
 * A chainable Drizzle-query-builder stand-in. Every builder method returns the
 * same object; awaiting the chain dequeues the next queued result in call
 * order. `tx` awaits happen sequentially in submitManualSelection, so a single
 * FIFO queue mirrors execution.
 *
 * Pass `recorded` to capture the payloads handed to `.set(...)` — the only way
 * to assert what was stamped onto the transition row.
 */
function makeTx(results: unknown[], recorded?: { set: unknown[] }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    'select',
    'selectDistinctOn',
    'from',
    'where',
    'orderBy',
    'limit',
    'for',
    'update',
    'insert',
    'values',
  ]) {
    builder[method] = vi.fn(chain);
  }
  builder.set = vi.fn((value: unknown) => {
    recorded?.set.push(value);
    return builder;
  });
  builder.then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(results.shift()).then(resolve, reject);
  return builder;
}

/** Queue of tx-chain results for the happy path, in execution order. */
function happyPathResults() {
  return [
    // lockedInstance (SELECT ... FOR UPDATE on processInstances)
    [
      {
        currentStateId: CURRENT_PHASE_ID,
        status: 'published',
        instanceData: instanceData(true),
      },
    ],
    // latestRow (SELECT ... FOR UPDATE on stateTransitionHistory)
    [
      {
        id: TRANSITION_HISTORY_ID,
        toStateId: CURRENT_PHASE_ID,
        transitionData: null,
        triggeredByProfileId: 'someone',
      },
    ],
    // attachedRows (no proposals attached yet)
    [],
    // UPDATE stateTransitionHistory
    undefined,
    // latestHistoryRows (one per unique proposal)
    [
      { proposalId: 'prop-1', historyId: 'hist-1' },
      { proposalId: 'prop-2', historyId: 'hist-2' },
    ],
    // INSERT decisionTransitionProposals
    undefined,
  ];
}

describe('submitManualSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertUserByAuthId.mockResolvedValue({
      profileId: USER_PROFILE_ID,
    } as never);
    mockAssertProfileAccess.mockResolvedValue(undefined as never);
    mockGetProposalIdsForPhase.mockResolvedValue(['prop-1', 'prop-2']);
    mockFindFirst.mockResolvedValue({
      profileId: DECISION_PROFILE_ID,
      status: 'published',
      currentStateId: CURRENT_PHASE_ID,
      instanceData: instanceData(true),
    } as never);
  });

  it('generates review assignments after the transaction commits', async () => {
    const callOrder: string[] = [];
    mockTransaction.mockImplementation(async (cb) => {
      const result = await (cb as (tx: unknown) => Promise<unknown>)(
        makeTx(happyPathResults()),
      );
      callOrder.push('tx-commit');
      return result;
    });
    mockRunGenerateReviewAssignments.mockImplementation(async () => {
      callOrder.push('generate-review-assignments');
    });

    await submitManualSelection({
      processInstanceId: INSTANCE_ID,
      proposalIds: ['prop-1', 'prop-2'],
      user,
    });

    expect(mockRunGenerateReviewAssignments).toHaveBeenCalledTimes(1);
    expect(mockRunGenerateReviewAssignments).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      fromPhaseId: PREVIOUS_PHASE_ID,
      toPhaseId: CURRENT_PHASE_ID,
      phases: instanceData(true).phases,
      advanceResult: {
        conflict: false,
        transitionHistoryId: TRANSITION_HISTORY_ID,
        selectedProposalIds: ['prop-1', 'prop-2'],
      },
    });
    // The regression guard: generation runs strictly after the tx commits.
    expect(callOrder).toEqual(['tx-commit', 'generate-review-assignments']);
    expect(mockProcessResults).not.toHaveBeenCalled();
  });

  it('does not generate review assignments when the phase has no review rule', async () => {
    mockFindFirst.mockResolvedValue({
      profileId: DECISION_PROFILE_ID,
      status: 'published',
      currentStateId: CURRENT_PHASE_ID,
      instanceData: instanceData(false),
    } as never);
    const results = happyPathResults();
    results[0] = [
      {
        currentStateId: CURRENT_PHASE_ID,
        status: 'published',
        instanceData: instanceData(false),
      },
    ];
    mockTransaction.mockImplementation(
      async (cb) =>
        await (cb as (tx: unknown) => Promise<unknown>)(makeTx(results)),
    );

    await submitManualSelection({
      processInstanceId: INSTANCE_ID,
      proposalIds: ['prop-1', 'prop-2'],
      user,
    });

    expect(mockRunGenerateReviewAssignments).not.toHaveBeenCalled();
  });

  it('does not generate review assignments when the transaction fails', async () => {
    // lockedInstance no longer published → ConflictError inside the tx.
    mockTransaction.mockImplementation(
      async (cb) =>
        await (cb as (tx: unknown) => Promise<unknown>)(
          makeTx([
            [
              {
                currentStateId: CURRENT_PHASE_ID,
                status: 'archived',
                instanceData: instanceData(true),
              },
            ],
          ]),
        ),
    );

    await expect(
      submitManualSelection({
        processInstanceId: INSTANCE_ID,
        proposalIds: ['prop-1', 'prop-2'],
        user,
      }),
    ).rejects.toThrow();

    expect(mockRunGenerateReviewAssignments).not.toHaveBeenCalled();
    expect(event.send).not.toHaveBeenCalled();
  });
});

// The final phase is where results publish, so it is the only place author
// notifications are composed — and the only place they are allowed at all.
describe('submitManualSelection author notifications', () => {
  const PROCESS_RESULT_ID = 'result-1';
  const messages = { funded: 'You were funded', notFunded: 'Not this round' };

  /** Three phases with the CURRENT one last, so this call publishes results. */
  const lastPhaseInstanceData = () => ({
    phases: [
      { phaseId: 'phase-0', name: 'Submission', rules: {} },
      { phaseId: PREVIOUS_PHASE_ID, name: 'Review', rules: {} },
      { phaseId: CURRENT_PHASE_ID, name: 'Voting', rules: {} },
    ],
    config: { reviewsPolicy: 'full_coverage' },
  });

  const lastPhaseResults = () => {
    const results = happyPathResults();
    results[0] = [
      {
        currentStateId: CURRENT_PHASE_ID,
        status: 'published',
        instanceData: lastPhaseInstanceData(),
      },
    ];
    return results;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertUserByAuthId.mockResolvedValue({
      profileId: USER_PROFILE_ID,
    } as never);
    mockAssertProfileAccess.mockResolvedValue(undefined as never);
    mockGetProposalIdsForPhase.mockResolvedValue(['prop-1', 'prop-2']);
    mockProcessResults.mockResolvedValue(PROCESS_RESULT_ID);
    mockFindFirst.mockResolvedValue({
      profileId: DECISION_PROFILE_ID,
      status: 'published',
      currentStateId: CURRENT_PHASE_ID,
      instanceData: lastPhaseInstanceData(),
    } as never);
  });

  it('stamps the messages on the transition row and announces the result row', async () => {
    const recorded = { set: [] as unknown[] };
    mockTransaction.mockImplementation(
      async (cb) =>
        await (cb as (tx: unknown) => Promise<unknown>)(
          makeTx(lastPhaseResults(), recorded),
        ),
    );

    await submitManualSelection({
      processInstanceId: INSTANCE_ID,
      proposalIds: ['prop-1', 'prop-2'],
      resultNotifications: messages,
      user,
    });

    expect(recorded.set[0]).toMatchObject({
      transitionData: {
        manualSelection: { resultNotifications: messages },
      },
    });
    // Refs only, both rows addressed by id — the workflow re-reads the copy.
    expect(event.send).toHaveBeenCalledWith({
      name: 'decisionResultsNotified',
      data: {
        processInstanceId: INSTANCE_ID,
        processResultId: PROCESS_RESULT_ID,
        transitionHistoryId: TRANSITION_HISTORY_ID,
        previousPhaseId: PREVIOUS_PHASE_ID,
      },
    });
  });

  it('trims the stored copy so trailing whitespace is not emailed', async () => {
    const recorded = { set: [] as unknown[] };
    mockTransaction.mockImplementation(
      async (cb) =>
        await (cb as (tx: unknown) => Promise<unknown>)(
          makeTx(lastPhaseResults(), recorded),
        ),
    );

    await submitManualSelection({
      processInstanceId: INSTANCE_ID,
      proposalIds: ['prop-1', 'prop-2'],
      resultNotifications: {
        funded: '  You were funded\n',
        notFunded: '\tNot this round  ',
      },
      user,
    });

    expect(recorded.set[0]).toMatchObject({
      transitionData: {
        manualSelection: { resultNotifications: messages },
      },
    });
    expect(recorded.set).toHaveLength(1);
  });

  // The review-selection flow confirms into what can be the final phase and
  // composes nothing; publishing has to stay possible without author copy.
  it('publishes without announcing anything when no messages are supplied', async () => {
    const recorded = { set: [] as unknown[] };
    mockTransaction.mockImplementation(
      async (cb) =>
        await (cb as (tx: unknown) => Promise<unknown>)(
          makeTx(lastPhaseResults(), recorded),
        ),
    );

    await submitManualSelection({
      processInstanceId: INSTANCE_ID,
      proposalIds: ['prop-1', 'prop-2'],
      user,
    });

    expect(mockProcessResults).toHaveBeenCalledTimes(1);
    expect(recorded.set[0]).not.toMatchObject({
      transitionData: { manualSelection: { resultNotifications: {} } },
    });
    expect(event.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'decisionResultsNotified' }),
    );
  });

  // Rejected before the transaction opens, so nothing publishes and the admin
  // can fix the copy rather than hitting the one-shot ConflictError on retry.
  // The message has to name the offending side — blaming `funded` for a blank
  // `notFunded` sends the admin to the wrong tab.
  it.each([
    [
      'the funded message is blank',
      { funded: '   ', notFunded: 'Not this round' },
      /funded message must be between/,
    ],
    [
      'the not-funded message is blank',
      { funded: 'You were funded', notFunded: '   ' },
      /notFunded message must be between/,
    ],
    [
      'a message is over the length cap',
      { funded: 'a'.repeat(4001), notFunded: 'Not this round' },
      /funded message must be between 1 and 4000/,
    ],
  ])(
    'refuses to publish results when %s',
    async (_label, notifications, message) => {
      await expect(
        submitManualSelection({
          processInstanceId: INSTANCE_ID,
          proposalIds: ['prop-1', 'prop-2'],
          resultNotifications: notifications,
          user,
        }),
      ).rejects.toThrow(message);

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockProcessResults).not.toHaveBeenCalled();
    },
  );

  // Whether the phase publishes is only knowable under the lock, so this one
  // rejects inside the transaction — which rolls back rather than confirming a
  // selection whose author copy would never be sent.
  it('rejects messages on a phase that publishes nothing', async () => {
    mockFindFirst.mockResolvedValue({
      profileId: DECISION_PROFILE_ID,
      status: 'published',
      currentStateId: CURRENT_PHASE_ID,
      instanceData: instanceData(false),
    } as never);
    const results = happyPathResults();
    results[0] = [
      {
        currentStateId: CURRENT_PHASE_ID,
        status: 'published',
        instanceData: instanceData(false),
      },
    ];
    mockTransaction.mockImplementation(
      async (cb) =>
        await (cb as (tx: unknown) => Promise<unknown>)(makeTx(results)),
    );

    await expect(
      submitManualSelection({
        processInstanceId: INSTANCE_ID,
        proposalIds: ['prop-1', 'prop-2'],
        resultNotifications: messages,
        user,
      }),
      // Pinned to the message: this path can throw ValidationError from four
      // other guards, and a bare `toThrow()` would pass on any of them.
    ).rejects.toThrow(/only sent when confirming the final phase/);

    expect(mockProcessResults).not.toHaveBeenCalled();
    expect(event.send).not.toHaveBeenCalled();
  });
});
