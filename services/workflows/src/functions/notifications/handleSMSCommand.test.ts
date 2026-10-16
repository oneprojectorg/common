import { InngestTestEngine } from '@inngest/test';
import { type PhoneNumber, parsePhoneNumber } from '@op/common';
import type { SmsKeyword } from '@op/core/sms';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { recordedSms, resetRecordedSms } from '../../../testing/mocks/sms';
import { SmsCommandFixture } from '../../../testing/smsCommandFixture';
import { handleSMSCommand } from './handleSMSCommand';

const NUMBERS = {
  member: '+15005550090',
  wrongSlug: '+15005550091',
  submitting: '+15005550093',
  stranger: '+15005550094',
  chatter: '+15005550095',
  joiner: '+15005550096',
  bareInfo: '+15005550097',
  owner: '+15005550098',
  outsider: '+15005550099',
  codeReply: '+15005550089',
  lister: '+15005550088',
} as const;

const HELP_MESSAGE =
  'Text INFO to see your decisions, or INFO and a decision name, for example INFO columbus. Reply STOP to unsubscribe.';

const inbound = (
  from: PhoneNumber,
  keyword: SmsKeyword | null,
  argument: string | null,
  code: string | null = null,
) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-command-${from}`,
    code,
    keyword,
    argument,
  },
});

beforeEach(() => {
  resetRecordedSms();
});

describe('handleSMSCommand against the database', () => {
  it('given a member texts INFO and the slug of a decision in a voting phase, then they get its phase, that voting is open and how many proposals are on the ballot', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.member);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      name: `Park Funding ${task.id}`,
      proposalTitles: [
        { title: 'Fifth Ave crosswalk lighting', budget: 85_000 },
        { title: 'Cleveland Ave protected bike lane', budget: 310_000 },
      ],
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', slug)],
    });

    expect(result).toEqual({ message: 'info sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `"Park Funding ${task.id}": Voting phase, voting open, 2 proposals.`,
    ]);
  });

  it('given a member texts INFO and the slug of a decision still taking submissions, then they are told voting is closed', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.submitting);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      name: `Bike Lanes ${task.id}`,
      proposalTitles: ['Fund the park'],
      currentPhaseId: 'submission',
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', slug)],
    });

    expect(result).toEqual({ message: 'info sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `"Bike Lanes ${task.id}": Submission phase, voting closed, 1 proposal.`,
    ]);
  });

  it('given a member texts INFO and a slug no decision has, then they are told it was not found', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.wrongSlug);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', `no-such-decision-${task.id}`)],
    });

    expect(result).toEqual({ message: 'decision not found' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `No decision named "no-such-decision-${task.id}" was found.`,
    ]);
  });

  it('given a member texts INFO and the slug of a decision they cannot read, then they are told it was not found, the same as a missing one', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const owner = await fixture.createPhoneOnlyAccount(
      parsePhoneNumber(NUMBERS.owner),
    );
    const outsiderPhone = parsePhoneNumber(NUMBERS.outsider);
    await fixture.createPhoneOnlyAccount(outsiderPhone);
    const { slug } = await fixture.createVotingInstance({
      owner,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
    });
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(outsiderPhone, 'info', slug)],
    });

    expect(result).toEqual({ message: 'decision not found' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `No decision named "${slug}" was found.`,
    ]);
  });

  it('given a member texts something that is not a command, then they get the help text', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.chatter);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, null, null)],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([HELP_MESSAGE]);
  });

  it('given a member of no decision texts INFO alone, then they are told they are in no decision yet', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.bareInfo);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', null)],
    });

    expect(result).toEqual({ message: 'decisions sent', count: 0 });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'You are not a participant in any decision yet.',
    ]);
  });

  it('given a member of two decisions texts INFO alone, then they get both by name and slug with the one open for voting first', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.lister);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const submitting = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      proposalTitles: [],
      name: `Bike Lanes ${task.id}`,
      currentPhaseId: 'submission',
    });
    const voting = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
      name: `Park Funding ${task.id}`,
    });
    await fixture.addMember(submitting.instanceProfileId, member);
    await fixture.addMember(voting.instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', null)],
    });

    expect(result).toEqual({ message: 'decisions sent', count: 2 });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      [
        'Your decisions:',
        `Park Funding ${task.id} (voting open) - INFO ${voting.slug}`,
        `Bike Lanes ${task.id} - INFO ${submitting.slug}`,
      ].join('\n'),
    ]);
  });

  it('given a text that is a signup code, even from a number that is already confirmed, then the command function sends nothing because signup owns code replies', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.codeReply);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, null, null, '123456')],
    });

    expect(result).toEqual({ message: 'signup code, left to signup' });
    expect(recordedSms).toEqual([]);
  });

  it('given a member texts JOIN, then nothing is sent because the signup function answers JOIN', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.joiner);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'join', null)],
    });

    expect(result).toEqual({ message: 'join is handled by signup' });
    expect(recordedSms).toEqual([]);
  });

  it('given a number with no account texts a command, then nothing is sent because the signup function owns unknown numbers', async () => {
    const phone = parsePhoneNumber(NUMBERS.stranger);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', 'columbus')],
    });

    expect(result).toEqual({ message: 'unknown number, skipped' });
    expect(recordedSms).toEqual([]);
  });
});
