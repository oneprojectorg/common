import { InngestTestEngine } from '@inngest/test';
import { getSmsProvider, listEligibleProposals, submitVote } from '@op/common';
import { Events } from '@op/events';
import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Everything the function's real steps talk to. Steps NOT mocked below run
// their real bodies through `@inngest/test`'s memoized replay, which is what
// lets these tests exercise the actual branching logic rather than a
// hand-rolled re-implementation of it.
vi.mock('@op/common', () => ({
  getSmsProvider: vi.fn(),
  listEligibleProposals: vi.fn(),
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
const OTHER_PROPOSAL_ID = '44444444-4444-4444-8444-444444444444';
const THIRD_PROPOSAL_ID = '55555555-5555-4555-8555-555555555555';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const triggerEvent = () => ({
  name: Events.voteSmsPromptRequested.name,
  data: {
    processInstanceId: PROCESS_INSTANCE_ID,
    authUserId: AUTH_USER_ID,
    phone: PHONE,
  },
});

const voteReply = (body: string) => ({
  data: { from: PHONE, body, messageSid: 'SM2' },
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('handleSmsVoteRequest', () => {
  it('reports no eligible proposals and stops before resolving a provider', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([]);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'no eligible proposals' });
    expect(logger.error).toHaveBeenCalledWith(
      'No eligible proposals found for SMS vote request',
      { processInstanceId: PROCESS_INSTANCE_ID },
    );
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it('reports sending as unavailable when no Messaging Service is configured', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
    ]);
    vi.mocked(getSmsProvider).mockReturnValue({} as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms sending unavailable' });
    expect(submitVote).not.toHaveBeenCalled();
  });

  it('fails the step on a rate-limited prompt send, so Inngest retries it', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
    ]);
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
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
    ]);
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
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
    ]);
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
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
    ]);
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

  it('records a vote for a single proposal after an unrelated reply, once a later reply confirms', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
    ]);
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
    expect(sendSms).toHaveBeenCalledWith({
      to: PHONE,
      body: 'Reply YES to vote for "Fund the park".',
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

  it('sends a numbered list and records a vote for the proposal picked by number', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
      { id: OTHER_PROPOSAL_ID, title: 'Repave the lot' },
      { id: THIRD_PROPOSAL_ID, title: 'Build the mural' },
    ]);
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-p' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    vi.mocked(submitVote).mockResolvedValue({
      id: 'vote-submission-2',
    } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [{ id: 'wait-for-vote-reply-1', handler: () => voteReply('2') }],
    });

    expect(sendSms).toHaveBeenCalledWith({
      to: PHONE,
      body: [
        'Reply with a number to vote:',
        '1. Fund the park',
        '2. Repave the lot',
        '3. Build the mural',
      ].join('\n'),
    });
    expect(result).toEqual({
      message: 'vote recorded',
      voteSubmissionId: 'vote-submission-2',
    });
    expect(submitVote).toHaveBeenCalledWith({
      data: {
        processInstanceId: PROCESS_INSTANCE_ID,
        selectedProposalIds: [OTHER_PROPOSAL_ID],
        authUserId: AUTH_USER_ID,
      },
      authUserId: AUTH_USER_ID,
    });
  });

  it('does not record a vote when a numbered-list reply is out of range', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
      { id: OTHER_PROPOSAL_ID, title: 'Repave the lot' },
    ]);
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-p' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        { id: 'wait-for-vote-reply-1', handler: () => voteReply('5') },
        { id: 'wait-for-vote-reply-2', handler: () => voteReply('5') },
        { id: 'wait-for-vote-reply-3', handler: () => voteReply('5') },
      ],
    });

    expect(result).toEqual({ message: 'reply did not confirm' });
    expect(submitVote).not.toHaveBeenCalled();
  });

  it('does not record a vote when a numbered-list reply is not numeric', async () => {
    vi.mocked(listEligibleProposals).mockResolvedValue([
      { id: PROPOSAL_ID, title: 'Fund the park' },
      { id: OTHER_PROPOSAL_ID, title: 'Repave the lot' },
    ]);
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-p' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        { id: 'wait-for-vote-reply-1', handler: () => voteReply('YES') },
        { id: 'wait-for-vote-reply-2', handler: () => voteReply('YES') },
        { id: 'wait-for-vote-reply-3', handler: () => voteReply('YES') },
      ],
    });

    expect(result).toEqual({ message: 'reply did not confirm' });
    expect(submitVote).not.toHaveBeenCalled();
  });
});
