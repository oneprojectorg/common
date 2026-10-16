import { InngestTestEngine } from '@inngest/test';
import { type PhoneNumber, parsePhoneNumber } from '@op/common';
import type { SmsKeyword } from '@op/core/sms';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { recordedSms, resetRecordedSms } from '../../../testing/mocks/sms';
import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSMSCommand } from './handleSMSCommand';

const NUMBERS = {
  member: '+15005550090',
  wrongCode: '+15005550091',
  fiveDigit: '+15005550093',
  stranger: '+15005550094',
  chatter: '+15005550095',
  joiner: '+15005550096',
  bareInfo: '+15005550097',
} as const;

const HELP_MESSAGE =
  'Text INFO, the decision name and a proposal code, for example INFO columbus 102. Reply STOP to unsubscribe.';

const inbound = (
  from: PhoneNumber,
  keyword: SmsKeyword | null,
  argument: string | null,
) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-command-${from}`,
    code: null,
    keyword,
    argument,
  },
});

beforeEach(() => {
  resetRecordedSms();
});

describe('handleSMSCommand against the database', () => {
  it('given a member texts INFO with the slug and a code, then they get the cost and summary of that proposal', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.member);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      proposalTitles: [
        { title: 'Fifth Ave crosswalk lighting', budget: 85_000 },
        {
          title: 'Cleveland Ave protected bike lane',
          budget: 310_000,
          summary: 'A curb-protected lane between Morse Rd and Innis Ave.',
        },
      ],
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', `${slug} 102`)],
    });

    expect(result).toEqual({ message: 'info sent' });
    expect(recordedSms[0]!.body).toBe(
      '102: "Cleveland Ave protected bike lane" ($310,000). A curb-protected lane between Morse Rd and Innis Ave.',
    );
  });

  it('given a code no proposal has, then the member is told which decision has no such code', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.wrongCode);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', `${slug} 999`)],
    });

    expect(result).toEqual({ message: 'proposal not found' });
    expect(recordedSms[0]!.body).toMatch(
      /^No proposal with code 999 in ".+"\.$/,
    );
  });

  it('given a decision whose codes have passed 9999 (planted directly, no service issues that many), when a member texts INFO with the slug and a five-digit code, then they get that proposal', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.fiveDigit);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      firstCode: 10000,
      proposalTitles: [
        'Fund the park',
        { title: 'Cleveland Ave protected bike lane', budget: 310_000 },
      ],
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', `${slug} 10001`)],
    });

    expect(result).toEqual({ message: 'info sent' });
    expect(recordedSms[0]!.body).toBe(
      '10001: "Cleveland Ave protected bike lane" ($310,000).',
    );
  });

  it('given a member texts something that is not a command, then they get the help text', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.chatter);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, null, null)],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([HELP_MESSAGE]);
  });

  it('given a member texts INFO with no decision and code after it, then they get the help text', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.bareInfo);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [inbound(phone, 'info', null)],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([HELP_MESSAGE]);
  });

  it('given a member texts JOIN, then nothing is sent because the signup function answers JOIN', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
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
      events: [inbound(phone, 'info', 'columbus 102')],
    });

    expect(result).toEqual({ message: 'unknown number, skipped' });
    expect(recordedSms).toEqual([]);
  });
});
