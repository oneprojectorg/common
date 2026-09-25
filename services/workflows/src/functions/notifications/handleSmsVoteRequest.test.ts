import { InngestTestEngine } from '@inngest/test';
import { getSmsProvider, submitVote } from '@op/common';
import { db } from '@op/db/client';
import { Events } from '@op/events';
import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Everything the function's real steps talk to. Steps NOT mocked below run
// their real bodies through `@inngest/test`'s memoized replay, which is what
// lets these tests exercise the actual branching logic rather than a
// hand-rolled re-implementation of it.
vi.mock('@op/db/client', () => ({ db: { select: vi.fn() } }));
vi.mock('@op/common', () => ({
  getSmsProvider: vi.fn(),
  // A real E.164 fixture below, so identity is a faithful stand-in.
  parsePhoneNumber: (value: string) => value,
  submitVote: vi.fn(),
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleSmsVoteRequest } from './handleSmsVoteRequest';

const PHONE = '+15005550006';
const PROCESS_INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const triggerEvent = () => ({
  name: Events.voteSmsPromptRequested.name,
  data: {
    processInstanceId: PROCESS_INSTANCE_ID,
    proposalId: PROPOSAL_ID,
    authUserId: AUTH_USER_ID,
    phone: PHONE,
  },
});

const voteReply = (body: string) => ({
  data: { from: PHONE, body, messageSid: 'SM2' },
});

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

describe('handleSmsVoteRequest', () => {
  it('reports the proposal as not found and stops before resolving a provider', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'proposal not found' });
    expect(logger.error).toHaveBeenCalledWith(
      'No proposal found for SMS vote request',
      { processInstanceId: PROCESS_INSTANCE_ID, proposalId: PROPOSAL_ID },
    );
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it('reports sending as unavailable when no Messaging Service is configured', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([{ title: 'Fund the park' }]));
    vi.mocked(getSmsProvider).mockReturnValue({} as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms sending unavailable' });
    expect(submitVote).not.toHaveBeenCalled();
  });

  it('fails the step on a rate-limited prompt send, so Inngest retries it', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([{ title: 'Fund the park' }]));
    const sendSms = vi.fn().mockResolvedValue({
      status: 'rejected',
      reason: 'rate_limited',
      retryable: true,
    });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { error } = await t.execute({ events: [triggerEvent()] });

    // Inngest serializes a real step failure into a plain {name, message,
    // stack} object rather than handing back a live Error instance.
    expect((error as Error).message).toContain(
      'Vote prompt send rejected: rate_limited',
    );
  });

  it('aborts the vote request when the prompt send is permanently rejected', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([{ title: 'Fund the park' }]));
    const sendSms = vi.fn().mockResolvedValue({
      status: 'rejected',
      reason: 'invalid_number',
      retryable: false,
    });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Vote prompt permanently rejected, aborting vote request',
      {
        processInstanceId: PROCESS_INSTANCE_ID,
        proposalId: PROPOSAL_ID,
        authUserId: AUTH_USER_ID,
        reason: 'invalid_number',
      },
    );
    expect(result).toEqual({
      message: 'vote prompt send rejected',
      reason: 'invalid_number',
    });
  });

  it('reports a timeout when no reply arrives before the first wait expires', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([{ title: 'Fund the park' }]));
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-p' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [{ id: 'wait-for-vote-reply-1', handler: () => null }],
    });

    expect(result).toEqual({ message: 'timed out waiting for vote reply' });
    expect(submitVote).not.toHaveBeenCalled();
  });

  it('gives up after exhausting every attempt on unrelated replies', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([{ title: 'Fund the park' }]));
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-p' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        { id: 'wait-for-vote-reply-1', handler: () => voteReply('nope') },
        { id: 'wait-for-vote-reply-2', handler: () => voteReply('huh?') },
        { id: 'wait-for-vote-reply-3', handler: () => voteReply('still no') },
      ],
    });

    expect(result).toEqual({ message: 'reply did not confirm' });
    expect(submitVote).not.toHaveBeenCalled();
  });

  it('records a vote after an unrelated reply, once a later reply confirms', async () => {
    vi.mocked(db.select).mockReturnValue(dbRows([{ title: 'Fund the park' }]));
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-p' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    vi.mocked(submitVote).mockResolvedValue({
      id: 'vote-submission-1',
    } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        { id: 'wait-for-vote-reply-1', handler: () => voteReply('nope') },
        { id: 'wait-for-vote-reply-2', handler: () => voteReply('yes') },
      ],
    });

    expect(result).toEqual({
      message: 'vote recorded',
      voteSubmissionId: 'vote-submission-1',
    });
    expect(submitVote).toHaveBeenCalledWith({
      data: {
        processInstanceId: PROCESS_INSTANCE_ID,
        selectedProposalIds: [PROPOSAL_ID],
        authUserId: AUTH_USER_ID,
      },
      authUserId: AUTH_USER_ID,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Recorded a vote from an SMS reply',
      {
        processInstanceId: PROCESS_INSTANCE_ID,
        proposalId: PROPOSAL_ID,
        authUserId: AUTH_USER_ID,
      },
    );
  });
});
