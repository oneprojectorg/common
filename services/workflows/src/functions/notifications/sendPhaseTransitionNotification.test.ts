import { InngestTestEngine } from '@inngest/test';
import {
  listEligibleProposals,
  listProcessParticipants,
  listSmsOnlyProcessParticipants,
  resolveManualSelectionStatus,
} from '@op/common';
import { db } from '@op/db/client';
import { OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Everything the function's real steps talk to. Steps NOT mocked below run
// their real bodies through `@inngest/test`'s memoized replay, which is what
// lets these tests exercise the actual branching logic rather than a
// hand-rolled re-implementation of it.
vi.mock('@op/db/client', () => ({ db: { select: vi.fn() } }));
vi.mock('@op/common', () => ({
  listEligibleProposals: vi.fn(),
  listProcessParticipants: vi.fn(),
  listSmsOnlyProcessParticipants: vi.fn(),
  resolveManualSelectionStatus: vi.fn(),
  // Mirrors the real predicates verbatim (packages/common/src/services/
  // decision/utils/phaseSettings.ts and votingEligibility.ts) — both are
  // pure, so re-deriving them here is faithful without pulling @op/common's
  // full module graph into this test.
  isSingleChoiceVotingPhase: (phase: {
    rules?: { voting?: { submit?: boolean; maxVotesPerMember?: number } };
  }) =>
    Boolean(phase.rules?.voting?.submit) &&
    phase.rules?.voting?.maxVotesPerMember === 1,
  isVotingEligible: (status: string | null | undefined) =>
    !!status && !['draft', 'rejected', 'duplicate'].includes(status),
}));
vi.mock('@op/core', () => ({
  OPURLConfig: () => ({ ENV_URL: 'https://example.org' }),
}));
vi.mock('@op/emails', () => ({
  OPBatchSend: vi.fn(),
  PhaseTransitionEmail: Object.assign(() => null, {
    subject: (title: string, phase: string) => `${title} — ${phase}`,
  }),
}));
vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// Only `inngest.send` is a spy; everything else (createFunction, the real
// event schemas) stays real, since this is the first workflow function in
// this stack to send a new event rather than only wait on/react to one.
vi.mock('@op/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@op/events')>();
  vi.spyOn(actual.inngest, 'send');
  return actual;
});

import { sendPhaseTransitionNotification } from './sendPhaseTransitionNotification';

const PROCESS_INSTANCE_ID = '66666666-6666-4666-8666-666666666666';
const PROFILE_ID = '77777777-7777-4777-8777-777777777777';
const ELIGIBLE_PROPOSAL_ID = '88888888-8888-4888-8888-888888888888';
const SMS_AUTH_USER_ID = '99999999-9999-4999-8999-999999999999';
const SMS_PHONE = '+15005550006';

const VOTING_PHASE_ID = 'voting';

const triggerEvent = () => ({
  name: Events.phaseTransitioned.name,
  data: {
    processInstanceId: PROCESS_INSTANCE_ID,
    fromPhaseId: 'submission',
    toPhaseId: VOTING_PHASE_ID,
  },
});

const processDataRow = (phase: {
  phaseId: string;
  name?: string;
  rules?: { voting?: { submit?: boolean; maxVotesPerMember?: number } };
}) => ({
  name: 'Park Funding',
  profileId: PROFILE_ID,
  instanceData: { phases: [phase] },
  currentStateId: 'submission',
  profileSlug: 'park-funding',
});

const SINGLE_CHOICE_VOTING_PHASE = {
  phaseId: VOTING_PHASE_ID,
  name: 'Voting',
  rules: { voting: { submit: true, maxVotesPerMember: 1 } },
};

const NON_VOTING_PHASE = {
  phaseId: VOTING_PHASE_ID,
  name: 'Voting',
  rules: {},
};

/** A Drizzle `db.select()...` chain stub: any method returns itself, and
 * awaiting it anywhere in the chain resolves to `rows`. */
const dbRows = (rows: unknown[]): never =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: unknown) => void) => resolve(rows);
        }
        return () => dbRows(rows);
      },
    },
  ) as never;

afterEach(() => {
  vi.resetAllMocks();
});

describe('sendPhaseTransitionNotification', () => {
  it('skips entirely when manual selections are not yet confirmed', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(NON_VOTING_PHASE)]),
    );
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: false,
      previousPhaseId: 'submission',
    });
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({
      message: `Skipped: selections not yet confirmed for instance ${PROCESS_INSTANCE_ID}`,
    });
    expect(listProcessParticipants).not.toHaveBeenCalled();
  });

  it('logs and continues without sending emails when no participant has one', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(NON_VOTING_PHASE)]),
    );
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: true,
    });
    vi.mocked(listProcessParticipants).mockResolvedValue([
      { authUserId: 'a1', email: null },
    ] as never);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(logger.warn).toHaveBeenCalledWith(
      'No email participants found for process instance',
      { processInstanceId: PROCESS_INSTANCE_ID, profileId: PROFILE_ID },
    );
    expect(OPBatchSend).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: '0 phase transition notification(s) sent',
    });
  });

  it('sends the email batch and reports how many went out', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(NON_VOTING_PHASE)]),
    );
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: true,
    });
    vi.mocked(listProcessParticipants).mockResolvedValue([
      { authUserId: 'a1', email: 'ada@example.org' },
      { authUserId: 'a2', email: 'grace@example.org' },
    ] as never);
    vi.mocked(OPBatchSend).mockResolvedValue({ data: [], errors: [] } as never);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(OPBatchSend).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      message: '2 phase transition notification(s) sent',
    });
  });

  /**
   * `@inngest/test` 0.1.9 documents "no retries modelled; any step or
   * function that fails once will fail permanently" — it cannot replay a
   * function past a step's real failure the way production Inngest does, so
   * it can't observe this function's own try/catch resuming past the
   * send-emails step into the SMS branch below it. This verifies the half
   * that *is* observable here: the batch failure is reported and logged
   * correctly. The continuation into SMS is enforced by the try/catch
   * itself and reviewed in code, not exercised by this harness.
   */
  it('reports and logs a phase transition email batch failure', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(NON_VOTING_PHASE)]),
    );
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: true,
    });
    vi.mocked(listProcessParticipants).mockResolvedValue([
      { authUserId: 'a1', email: 'ada@example.org' },
    ] as never);
    vi.mocked(OPBatchSend).mockResolvedValue({
      data: [],
      errors: [{ email: 'ada@example.org', error: new Error('bounced') }],
    } as never);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { error } = await t.execute({ events: [triggerEvent()] });

    expect((error as Error).message).toContain(
      'Phase transition email batch failed for 1 recipient(s)',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Some phase transition notifications failed to send',
      { processInstanceId: PROCESS_INSTANCE_ID, failedCount: 1 },
    );
  });

  it('skips the SMS branch entirely when the phase is not a single-choice voting phase', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(NON_VOTING_PHASE)]),
    );
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: true,
    });
    vi.mocked(listProcessParticipants).mockResolvedValue([
      { authUserId: 'a1', email: 'ada@example.org' },
    ] as never);
    vi.mocked(OPBatchSend).mockResolvedValue({ data: [], errors: [] } as never);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    await t.execute({ events: [triggerEvent()] });

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(listSmsOnlyProcessParticipants).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('skips the SMS branch when there are no eligible proposals', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(SINGLE_CHOICE_VOTING_PHASE)]),
    );
    vi.mocked(listEligibleProposals).mockResolvedValue([]);
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: true,
    });
    vi.mocked(listProcessParticipants).mockResolvedValue([
      { authUserId: 'a1', email: 'ada@example.org' },
    ] as never);
    vi.mocked(OPBatchSend).mockResolvedValue({ data: [], errors: [] } as never);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    await t.execute({ events: [triggerEvent()] });

    expect(listSmsOnlyProcessParticipants).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('sends a vote prompt to every phone-only participant, for one or many eligible proposals', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      dbRows([processDataRow(SINGLE_CHOICE_VOTING_PHASE)]),
    );
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: ELIGIBLE_PROPOSAL_ID, title: 'Fund the park' },
      { id: 'other-proposal', title: 'Repave the lot' },
    ]);
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: true,
    });
    vi.mocked(listProcessParticipants).mockResolvedValue([
      { authUserId: 'a1', email: 'ada@example.org' },
    ] as never);
    vi.mocked(OPBatchSend).mockResolvedValue({ data: [], errors: [] } as never);
    vi.mocked(listSmsOnlyProcessParticipants).mockResolvedValue([
      { authUserId: SMS_AUTH_USER_ID, phone: SMS_PHONE },
      { authUserId: 'sms-user-2', phone: '+15005550001' },
    ]);
    // `@inngest/test` doesn't mock `inngest.send` on its own (documented in
    // its README); the bare spy from the module mock above calls through to
    // the real client unless given an implementation here.
    vi.mocked(inngest.send).mockResolvedValue(undefined as never);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    await t.execute({ events: [triggerEvent()] });

    // handleSmsVoteRequest resolves eligible proposals itself (single keyword
    // vs. numbered list); this only has to prove the fan-out reaches every
    // phone-only participant once the phase and gate allow it.
    expect(inngest.send).toHaveBeenCalledTimes(2);
    expect(inngest.send).toHaveBeenCalledWith({
      name: Events.voteSmsPromptRequested.name,
      data: {
        processInstanceId: PROCESS_INSTANCE_ID,
        authUserId: SMS_AUTH_USER_ID,
        phone: SMS_PHONE,
      },
    });
    expect(inngest.send).toHaveBeenCalledWith({
      name: Events.voteSmsPromptRequested.name,
      data: {
        processInstanceId: PROCESS_INSTANCE_ID,
        authUserId: 'sms-user-2',
        phone: '+15005550001',
      },
    });
  });
});
