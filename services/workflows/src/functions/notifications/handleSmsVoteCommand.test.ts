import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsVoteCommand } from './handleSmsVoteCommand';

const NUMBERS = {
  member: '+15005550040',
  noSlug: '+15005550041',
  unknownSlug: '+15005550042',
  twoProposals: '+15005550043',
  votingClosed: '+15005550046',
  outsider: '+15005550044',
  stranger: '+15005550045',
} as const;

const voteCommand = (from: PhoneNumber, argument: string | null) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-vote-${from}`,
    code: null,
    keyword: 'vote' as const,
    argument,
    codes: [],
  },
});

const sentEvents = () =>
  vi
    .mocked(inngest.send)
    .mock.calls.flatMap(([payload]) =>
      Array.isArray(payload) ? payload : [payload],
    );

beforeEach(() => {
  memorySmsProvider.reset();
  vi.spyOn(inngest, 'send').mockResolvedValue({ ids: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleSmsVoteCommand against the database', () => {
  it('given a member texts VOTE and the decision slug, when the decision is in a voting phase with proposals, then a ballot is requested for them', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.member);
    const voter = await fixture.createPhoneOnlyAccount(phone);
    const { instanceId, instanceProfileId, slug } =
      await fixture.createVotingInstance({
        owner: voter,
        maxVotesPerMember: 1,
        proposalTitles: ['Fund the park'],
      });
    await fixture.addMember(instanceProfileId, voter);
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, slug)],
    });

    expect(result).toEqual({ message: 'ballot requested' });
    expect(sentEvents()).toEqual([
      {
        name: Events.voteSmsBallotRequested.name,
        data: {
          processInstanceId: instanceId,
          authUserId: voter.authUserId,
          phone,
        },
      },
    ]);
    expect(memorySmsProvider.sent).toEqual([]);
  });

  it('given a member texts VOTE with no decision named, then they are told how to name one', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.noSlug);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, null)],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringContaining('VOTE'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(sentEvents()).toEqual([]);
  });

  it('given a member names a decision that does not exist, then they are told it was not found', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.unknownSlug);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, 'no-such-decision')],
    });

    expect(result).toEqual({ message: 'decision not found' });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringContaining('no-such-decision'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(sentEvents()).toEqual([]);
  });

  it('given the decision is in a voting phase with no proposals, then they are told there is nothing to vote on', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.twoProposals);
    const voter = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: voter,
      maxVotesPerMember: 1,
      proposalTitles: [],
    });
    await fixture.addMember(instanceProfileId, voter);
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, slug)],
    });

    expect(result).toEqual({
      message: 'no ballot by sms',
      votingOpen: true,
      eligibleProposalCount: 0,
    });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringContaining('has no proposals'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(sentEvents()).toEqual([]);
  });

  it('given the decision is not in a voting phase, then they are told voting is not open', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.votingClosed);
    const voter = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: voter,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
      currentPhaseId: 'submission',
    });
    await fixture.addMember(instanceProfileId, voter);
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, slug)],
    });

    expect(result).toEqual({
      message: 'no ballot by sms',
      votingOpen: false,
      eligibleProposalCount: 0,
    });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringContaining('is not open'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(sentEvents()).toEqual([]);
  });

  it('given a confirmed account that is not a member of the decision, then they are told they are not a participant', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.outsider);
    const outsider = await fixture.createPhoneOnlyAccount(phone);
    const owner = await fixture.createEmailAccount();
    const { slug } = await fixture.createVotingInstance({
      owner,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
    });
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, slug)],
    });

    expect(result).toEqual({ message: 'not a participant' });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringContaining('not a participant'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(sentEvents()).toEqual([]);
    expect(outsider.authUserId).toEqual(expect.any(String));
  });

  it('given a number with no account texts VOTE, then nothing is sent and no prompt is requested', async () => {
    const phone = parsePhoneNumber(NUMBERS.stranger);
    const t = new InngestTestEngine({ function: handleSmsVoteCommand });

    const { result } = await t.execute({
      events: [voteCommand(phone, 'columbus')],
    });

    expect(result).toEqual({ message: 'unknown number, skipped' });
    expect(memorySmsProvider.sent).toEqual([]);
    expect(sentEvents()).toEqual([]);
  });
});
