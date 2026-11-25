import { InngestTestEngine } from '@inngest/test';
import {
  listProcessParticipants,
  resolveManualSelectionStatus,
} from '@op/common';
import { OPBatchSend, PhaseTransitionEmail } from '@op/emails';
import { Events } from '@op/events';
import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `vi.mock` factories are hoisted above every `const`, so the values they
 * close over must be hoisted too. The function reads the instance with a
 * `select().from().leftJoin().where().limit()` chain; every link returns the
 * same object so the chain resolves to whatever row a test stored.
 */
const { APP_URL, instanceRowHolder, selectChain } = vi.hoisted(() => {
  const instanceRowHolder: { row?: unknown } = {};
  const selectChain = {
    from: () => selectChain,
    leftJoin: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve([instanceRowHolder.row]),
  };
  return { APP_URL: 'https://app.test', instanceRowHolder, selectChain };
});

vi.mock('@op/common', () => ({
  listProcessParticipants: vi.fn(),
  resolveManualSelectionStatus: vi.fn(),
}));
vi.mock('@op/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@op/core')>()),
  OPURLConfig: () => ({ ENV_URL: APP_URL }),
}));
vi.mock('@op/db/client', () => ({ db: { select: () => selectChain } }));
vi.mock('@op/emails', () => ({
  OPBatchSend: vi.fn(),
  PhaseTransitionEmail: Object.assign(vi.fn(), {
    subject: (processTitle: string, toPhaseName: string) =>
      `${processTitle} — now in ${toPhaseName}`,
  }),
}));
vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { sendPhaseTransitionNotification } from './sendPhaseTransitionNotification';

const PROCESS_INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_SLUG = 'budget-2026';
const PROCESS_NAME = 'Participatory Budgeting 2026';

const PHASES = [
  { phaseId: 'submission', name: 'Submission' },
  { phaseId: 'voting', name: 'Voting' },
  { phaseId: 'results', name: 'Results' },
] as const;

const instanceRow = (row: unknown) => {
  instanceRowHolder.row = row;
};

const participant = (email: string | null, n: number) => ({
  authUserId: `auth-user-${n}`,
  email,
});

const phaseTransitionedEvent = (toPhaseId: string) => ({
  name: Events.phaseTransitioned.name,
  data: {
    processInstanceId: PROCESS_INSTANCE_ID,
    fromPhaseId: 'submission',
    toPhaseId,
  },
});

/** A confirmed process with two participants, ready to send. */
const processReadyToNotify = () => {
  instanceRow({
    name: PROCESS_NAME,
    profileId: PROFILE_ID,
    instanceData: { phases: PHASES },
    currentStateId: 'voting',
    profileSlug: PROFILE_SLUG,
  });
  vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
    selectionsAreConfirmed: true,
  });
  vi.mocked(listProcessParticipants).mockResolvedValue([
    participant('ada@example.org', 1),
    participant('grace@example.org', 2),
  ]);
  vi.mocked(OPBatchSend).mockResolvedValue({ data: [], errors: [] });
};

/**
 * `OPBatchSend` is mocked, so nothing renders the email. Render the first
 * batch item's component by hand to read the props the template received.
 */
const renderedEmailProps = () => {
  const [emails] = vi.mocked(OPBatchSend).mock.calls[0] ?? [];
  emails?.[0]?.component();
  return vi.mocked(PhaseTransitionEmail).mock.calls[0]?.[0];
};

afterEach(() => {
  vi.resetAllMocks();
  instanceRowHolder.row = undefined;
});

describe('sendPhaseTransitionNotification', () => {
  it('given a transition into a middle phase, then the email links to the process overview', async () => {
    processReadyToNotify();
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({
      events: [phaseTransitionedEvent('voting')],
    });

    expect(result).toEqual({
      sent: 2,
      message: '2 phase transition notification(s) sent',
    });
    expect(renderedEmailProps()).toEqual({
      processTitle: PROCESS_NAME,
      toPhaseName: 'Voting',
      phaseNumber: 2,
      totalPhases: 3,
      processUrl: `${APP_URL}/decisions/${PROFILE_SLUG}`,
    });
  });

  it('given a transition into the final phase, then the email links to the current-phase view', async () => {
    processReadyToNotify();
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    await t.execute({ events: [phaseTransitionedEvent('results')] });

    expect(renderedEmailProps()).toEqual({
      processTitle: PROCESS_NAME,
      toPhaseName: 'Results',
      phaseNumber: 3,
      totalPhases: 3,
      processUrl: `${APP_URL}/decisions/${PROFILE_SLUG}/current`,
    });
  });

  it('given a target phase the instance does not list, then the email falls back to the overview and the phase id', async () => {
    processReadyToNotify();
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    await t.execute({ events: [phaseTransitionedEvent('unknown-phase')] });

    expect(renderedEmailProps()).toEqual({
      processTitle: PROCESS_NAME,
      toPhaseName: 'unknown-phase',
      phaseNumber: 1,
      totalPhases: 3,
      processUrl: `${APP_URL}/decisions/${PROFILE_SLUG}`,
    });
  });

  it('given every email goes to one inbox, then it sends once per address', async () => {
    processReadyToNotify();
    vi.mocked(listProcessParticipants).mockResolvedValue([
      participant('Ada@example.org', 1),
      participant('ada@example.org', 2),
      participant(null, 3),
    ]);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({
      events: [phaseTransitionedEvent('voting')],
    });

    expect(result).toEqual({
      sent: 1,
      message: '1 phase transition notification(s) sent',
    });
    expect(OPBatchSend).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          to: 'Ada@example.org',
          subject: `${PROCESS_NAME} — now in Voting`,
        }),
      ],
      { idempotencyKeyPrefix: expect.stringMatching(/^phase-transition\//) },
    );
  });

  it('given the inbound selections are not yet confirmed, then it sends nothing', async () => {
    processReadyToNotify();
    vi.mocked(resolveManualSelectionStatus).mockResolvedValue({
      selectionsAreConfirmed: false,
      previousPhaseId: 'voting',
    });
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({
      events: [phaseTransitionedEvent('results')],
    });

    expect(result).toEqual({
      message: `Skipped: selections not yet confirmed for instance ${PROCESS_INSTANCE_ID}`,
    });
    expect(listProcessParticipants).not.toHaveBeenCalled();
    expect(OPBatchSend).not.toHaveBeenCalled();
  });

  it('given no participant has an email, then it sends nothing', async () => {
    processReadyToNotify();
    vi.mocked(listProcessParticipants).mockResolvedValue([
      participant(null, 1),
    ]);
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    await t.execute({ events: [phaseTransitionedEvent('results')] });

    expect(logger.warn).toHaveBeenCalledWith(
      'No participants found for process instance',
      { processInstanceId: PROCESS_INSTANCE_ID, profileId: PROFILE_ID },
    );
    expect(OPBatchSend).not.toHaveBeenCalled();
  });
});
