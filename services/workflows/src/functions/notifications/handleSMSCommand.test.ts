import { InngestTestEngine } from '@inngest/test';
import { SMS_MAX_BODY_LENGTH, parsePhoneNumber } from '@op/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  recordedSms,
  refuseSmsTo,
  resetRecordedSms,
} from '../../../testing/mocks/sms';
import { SmsCommandFixture } from '../../../testing/smsCommandFixture';
import { smsInboundEvent } from '../../../testing/smsInboundEvent';
import { handleSMSCommand } from './handleSMSCommand';
import {
  SMS_ALREADY_JOINED_MESSAGE,
  SMS_COMMAND_HELP_MESSAGE,
} from './smsReply';

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
  longText: '+15005550087',
  publicOnly: '+15005550086',
  refused: '+15005550085',
  flagOff: '+15005550084',
  lineMember: '+15005550080',
  lineSlugMember: '+15005550081',
  unboundLineMember: '+15005550082',
} as const;

const LINES = {
  bare: '+16145550130',
  slug: '+16145550131',
  unbound: '+16145550132',
} as const;

beforeEach(() => {
  resetRecordedSms();
});

describe('handleSMSCommand against the database', () => {
  it('given a member texts SHOW and the slug of a decision in a voting phase, then they get its phase, that voting is open and how many proposals are on the ballot', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.member);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      name: `Park Funding ${task.id}`,
      proposalTitles: [
        { title: 'Fifth Ave crosswalk lighting', budget: 85_000 },
        { title: 'Cleveland Ave protected bike lane', budget: 310_000 },
      ],
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: slug }),
      ],
    });

    expect(result).toEqual({ message: 'decision sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `"Park Funding ${task.id}": Voting phase, voting open, 2 proposals.`,
    ]);
  });

  it('given a member texts SHOW and the slug of a decision still taking submissions, then they are told voting is closed', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.submitting);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      name: `Bike Lanes ${task.id}`,
      proposalTitles: ['Fund the park'],
      currentPhaseId: 'submission',
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: slug }),
      ],
    });

    expect(result).toEqual({ message: 'decision sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `"Bike Lanes ${task.id}": Submission phase, voting closed, 1 proposal.`,
    ]);
  });

  it('given a member texts SHOW and a slug no decision has, then they are told it was not found', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.wrongSlug);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({
          from: phone,
          keyword: 'show',
          argument: `no-such-decision-${task.id}`,
        }),
      ],
    });

    expect(result).toEqual({ message: 'decision not found' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `No decision named "no-such-decision-${task.id}" was found.`,
    ]);
  });

  it('given a member texts SHOW followed by as much text as one message holds, then the not-found reply quotes a clipped name and still fits one message', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.longText);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });
    const argument = `${task.id}-`.padEnd(
      SMS_MAX_BODY_LENGTH - 'show '.length,
      'x',
    );

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: argument }),
      ],
    });

    expect(result).toEqual({ message: 'decision not found' });
    const [body] = recordedSms.map((sms) => sms.body);
    expect(body).toMatch(/^No decision named ".+\.\.\." was found\.$/);
    expect(body!.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
  });

  it('given a member texts SHOW and the slug of a decision they cannot read, then they are told it was not found, the same as a missing one', async ({
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
      proposalTitles: ['Fund the park'],
    });
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({
          from: outsiderPhone,
          keyword: 'show',
          argument: slug,
        }),
      ],
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
      events: [smsInboundEvent({ from: phone, keyword: null, argument: null })],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      SMS_COMMAND_HELP_MESSAGE,
    ]);
  });

  it('given a member of no decision texts SHOW alone, then they are told they are in no decision yet', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.bareInfo);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: null }),
      ],
    });

    expect(result).toEqual({ message: 'decisions sent', count: 0 });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'You are not a participant in any decision yet.',
    ]);
  });

  it('given a member of two decisions texts SHOW alone, then they get both by name and slug with the one open for voting first', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.lister);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const submitting = await fixture.createVotingInstance({
      owner: member,
      proposalTitles: [],
      name: `Bike Lanes ${task.id}`,
      currentPhaseId: 'submission',
    });
    const voting = await fixture.createVotingInstance({
      owner: member,
      proposalTitles: ['Fund the park'],
      name: `Park Funding ${task.id}`,
    });
    await fixture.addMember(submitting.instanceProfileId, member);
    await fixture.addMember(voting.instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: null }),
      ],
    });

    expect(result).toEqual({ message: 'decisions sent', count: 2 });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      [
        'Your decisions:',
        `Park Funding ${task.id} (voting open) - SHOW ${voting.slug}`,
        `Bike Lanes ${task.id} - SHOW ${submitting.slug}`,
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
      events: [
        smsInboundEvent({
          from: phone,
          keyword: null,
          argument: null,
          code: '123456',
        }),
      ],
    });

    expect(result).toEqual({ message: 'signup code, left to signup' });
    expect(recordedSms).toEqual([]);
  });

  it('given a member texts JOIN, then they are told they already have an account and how to see their decisions', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.joiner);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'join', argument: null }),
      ],
    });

    expect(result).toEqual({ message: 'already joined' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      SMS_ALREADY_JOINED_MESSAGE,
    ]);
  });

  it('given a public decision the member never joined, when they text SHOW alone, then it is not listed, and SHOW with its slug still describes it', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.publicOnly);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      proposalTitles: ['Fund the park'],
      name: `Open Air ${task.id}`,
    });
    await fixture.makePublic(instanceProfileId);

    const list = await new InngestTestEngine({
      function: handleSMSCommand,
    }).execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: null }),
      ],
    });
    const show = await new InngestTestEngine({
      function: handleSMSCommand,
    }).execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: slug }),
      ],
    });

    expect(list.result).toEqual({ message: 'decisions sent', count: 0 });
    expect(show.result).toEqual({ message: 'decision sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'You are not a participant in any decision yet.',
      `"Open Air ${task.id}": Voting phase, voting open, 1 proposal.`,
    ]);
  });

  it('given the carrier refuses the reply because the number opted out, then the result says the reply was rejected and nothing else is sent', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.refused);
    await fixture.createPhoneOnlyAccount(phone);
    refuseSmsTo(phone, { reason: 'opted_out', retryable: false });
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: null }),
      ],
    });

    expect(result).toEqual({ message: 'reply rejected', reason: 'opted_out' });
    expect(recordedSms).toEqual([]);
  });

  it('given the sms-commands flag is off, when a member texts SHOW, then nothing is sent', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.flagOff);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const previous = process.env.NEXT_PUBLIC_E2E;
    delete process.env.NEXT_PUBLIC_E2E;
    try {
      const { result } = await t.execute({
        events: [
          smsInboundEvent({ from: phone, keyword: 'show', argument: null }),
        ],
      });

      expect(result).toEqual({ message: 'sms commands disabled' });
      expect(recordedSms).toEqual([]);
    } finally {
      process.env.NEXT_PUBLIC_E2E = previous;
    }
  });

  it('given a number with no account texts a command, then nothing is sent because the signup function owns unknown numbers', async () => {
    const phone = parsePhoneNumber(NUMBERS.stranger);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, keyword: 'show', argument: 'columbus' }),
      ],
    });

    expect(result).toEqual({ message: 'unknown number, skipped' });
    expect(recordedSms).toEqual([]);
  });
});

describe('handleSMSCommand on a decision line', () => {
  it("given a member texts SHOW alone to a decision's own line, then that decision is described and the reply comes from the line", async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.lineMember);
    const line = parsePhoneNumber(LINES.bare);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceId, instanceProfileId } =
      await fixture.createVotingInstance({
        owner: member,
        name: `Line Funding ${task.id}`,
        proposalTitles: ['Crosswalk lighting'],
      });
    await fixture.addMember(instanceProfileId, member);
    await fixture.bindLine(instanceId, line);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone, to: line, keyword: 'show' })],
    });

    expect(result).toEqual({ message: 'decision sent' });
    expect(recordedSms).toEqual([
      expect.objectContaining({
        to: phone,
        from: line,
        body: `"Line Funding ${task.id}": Voting phase, voting open, 1 proposal.`,
      }),
    ]);
  });

  it("given a member of two decisions texts SHOW and the other decision's slug to a line, then the slug wins and the reply still comes from the line", async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.lineSlugMember);
    const line = parsePhoneNumber(LINES.slug);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const bound = await fixture.createVotingInstance({
      owner: member,
      name: `Bound ${task.id}`,
      proposalTitles: ['One'],
    });
    const other = await fixture.createVotingInstance({
      owner: member,
      name: `Other ${task.id}`,
      proposalTitles: ['Two', 'Three'],
    });
    await fixture.addMember(bound.instanceProfileId, member);
    await fixture.addMember(other.instanceProfileId, member);
    await fixture.bindLine(bound.instanceId, line);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({
          from: phone,
          to: line,
          keyword: 'show',
          argument: other.slug,
        }),
      ],
    });

    expect(result).toEqual({ message: 'decision sent' });
    expect(recordedSms).toEqual([
      expect.objectContaining({
        from: line,
        body: `"Other ${task.id}": Voting phase, voting open, 2 proposals.`,
      }),
    ]);
  });
  it('given a member of no decision texts SHOW alone to a number no decision owns, then they get the same reply as on the shared number and it names no from line', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.unboundLineMember);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSMSCommand });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({ from: phone, to: LINES.unbound, keyword: 'show' }),
      ],
    });

    expect(result).toEqual({ message: 'decisions sent', count: 0 });
    expect(recordedSms).toEqual([
      expect.objectContaining({ to: phone, from: null }),
    ]);
  });
});
