import { InngestTestEngine } from '@inngest/test';
import {
  SMS_MAX_BODY_LENGTH,
  findVoterEnrolment,
  parsePhoneNumber,
} from '@op/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryGeocoder } from '../../../testing/mocks/geocoder';
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
  enrolStart: '+15005550070',
  enrolAddress: '+15005550071',
  enrolNotFound: '+15005550072',
  enrolOutside: '+15005550073',
  enrolAgree: '+15005550074',
  agreeNothing: '+15005550075',
  voteNoRule: '+15005550076',
  freeNothing: '+15005550077',
  voteNoSlug: '+15005550078',
  browseFirst: '+15005550060',
  browseMore: '+15005550061',
  browseNoCursor: '+15005550062',
  infoFound: '+15005550063',
  infoUnknown: '+15005550064',
  browseUnenrolled: '+15005550065',
  browseClosed: '+15005550066',
  enrolRewrite: '+15005550079',
  enrolSwitch: '+15005550083',
  agreeRewritten: '+15005550027',
} as const;

const LINES = {
  bare: '+16145550130',
  slug: '+16145550131',
  unbound: '+16145550132',
  enrolStart: '+16145550133',
  enrolAddress: '+16145550134',
  enrolNotFound: '+16145550135',
  enrolOutside: '+16145550136',
  enrolAgree: '+16145550137',
  browseFirst: '+16145550138',
  browseMore: '+16145550139',
  infoFound: '+16145550140',
  infoUnknown: '+16145550141',
  browseUnenrolled: '+16145550142',
  browseClosed: '+16145550143',
  enrolRewrite: '+16145550190',
  enrolSwitch: '+16145550191',
  agreeRewritten: '+16145550170',
} as const;

beforeEach(() => {
  resetRecordedSms();
  memoryGeocoder.reset();
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
      `"Park Funding ${task.id}" (${slug}): Voting phase, voting open, 2 proposals.`,
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
      `"Bike Lanes ${task.id}" (${slug}): Submission phase, voting closed, 1 proposal.`,
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
      `"Open Air ${task.id}" (${slug}): Voting phase, voting open, 1 proposal.`,
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
    const { instanceId, instanceProfileId, slug } =
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
        body: `"Line Funding ${task.id}" (${slug}): Voting phase, voting open, 1 proposal.`,
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
        body: `"Other ${task.id}" (${other.slug}): Voting phase, voting open, 2 proposals.`,
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

describe('handleSMSCommand registration over SMS', () => {
  const ATTESTATION = 'I affirm that I meet the eligibility requirements.';
  const INSIDE = [{ lat: 40.5, lng: -73.5 }];
  const OUTSIDE = [{ lat: 10, lng: 10 }];

  const seed = async (
    fixture: SmsCommandFixture,
    {
      phone,
      line,
      name,
      withRule = true,
    }: {
      phone: string;
      line: string | null;
      name: string;
      withRule?: boolean;
    },
  ) => {
    const member = await fixture.createPhoneOnlyAccount(
      parsePhoneNumber(phone),
    );
    const { instanceId, instanceProfileId, slug } =
      await fixture.createVotingInstance({
        owner: member,
        name,
        proposalTitles: ['Crosswalk lighting'],
        ...(withRule
          ? { enrolment: { attestation: ATTESTATION, boundary: true } }
          : {}),
      });
    await fixture.addMember(instanceProfileId, member);
    const district = await fixture.createDistrict({
      profileId: instanceProfileId,
      name: `District 5 ${name}`,
    });
    if (line) {
      await fixture.bindLine(instanceId, parsePhoneNumber(line));
    }
    return { member, instanceId, slug, district };
  };

  const run = (event: ReturnType<typeof smsInboundEvent>) =>
    new InngestTestEngine({ function: handleSMSCommand }).execute({
      events: [event],
    });

  it('given a member texts VOTE to the line of a decision that requires registration, then they are welcomed and asked for their address, and a row waits for it', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Enrol Start ${task.id}`;
    const { member, instanceId } = await seed(fixture, {
      phone: NUMBERS.enrolStart,
      line: LINES.enrolStart,
      name,
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.enrolStart,
        to: LINES.enrolStart,
        keyword: 'vote',
      }),
    );

    expect(result).toEqual({ message: 'enrolment started' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `Welcome to "${name}". Two quick steps to register: your address, then a short affirmation. No ID needed. What's your address?`,
    ]);
    await expect(
      findVoterEnrolment({
        processInstanceId: instanceId,
        authUserId: member.authUserId,
      }),
    ).resolves.toMatchObject({
      taxonomyTermId: null,
      enrolledAt: null,
    });
  });

  it('given a member who was asked for an address texts one inside a district, then the district is confirmed with the attestation and the row waits for AGREE', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Enrol Address ${task.id}`;
    const { member, instanceId, district } = await seed(fixture, {
      phone: NUMBERS.enrolAddress,
      line: LINES.enrolAddress,
      name,
    });
    const address = `375 S High St ${task.id}`;
    memoryGeocoder.set(address, INSIDE);
    await run(
      smsInboundEvent({
        from: NUMBERS.enrolAddress,
        to: LINES.enrolAddress,
        keyword: 'vote',
      }),
    );

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.enrolAddress,
        to: LINES.enrolAddress,
        body: address,
        messageSid: `SM-${task.id}-address`,
      }),
    );

    expect(result).toEqual({ message: 'address resolved' });
    expect(recordedSms.at(-1)?.body).toBe(
      `That's ${district.name}. Reply AGREE to affirm: "${ATTESTATION}"`,
    );
    await expect(
      findVoterEnrolment({
        processInstanceId: instanceId,
        authUserId: member.authUserId,
      }),
    ).resolves.toMatchObject({
      taxonomyTermId: district.taxonomyTermId,
      enrolledAt: null,
    });
  });

  it('given a member who was asked for an address texts one that geocodes to nothing, then they are asked to text it again and the row still waits for an address', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const { member, instanceId } = await seed(fixture, {
      phone: NUMBERS.enrolNotFound,
      line: LINES.enrolNotFound,
      name: `Enrol Not Found ${task.id}`,
    });
    await run(
      smsInboundEvent({
        from: NUMBERS.enrolNotFound,
        to: LINES.enrolNotFound,
        keyword: 'vote',
      }),
    );

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.enrolNotFound,
        to: LINES.enrolNotFound,
        body: `nowhere ${task.id}`,
        messageSid: `SM-${task.id}-nowhere`,
      }),
    );

    expect(result).toEqual({ message: 'address not found' });
    expect(recordedSms.at(-1)?.body).toBe(
      'That address was not found. Text it again with the street, city and ZIP.',
    );
    await expect(
      findVoterEnrolment({
        processInstanceId: instanceId,
        authUserId: member.authUserId,
      }),
    ).resolves.toMatchObject({
      taxonomyTermId: null,
      enrolledAt: null,
    });
  });

  it('given a member who was asked for an address texts one outside every district, then they are told so and the row still waits for an address', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Enrol Outside ${task.id}`;
    await seed(fixture, {
      phone: NUMBERS.enrolOutside,
      line: LINES.enrolOutside,
      name,
    });
    const address = `far away ${task.id}`;
    memoryGeocoder.set(address, OUTSIDE);
    await run(
      smsInboundEvent({
        from: NUMBERS.enrolOutside,
        to: LINES.enrolOutside,
        keyword: 'vote',
      }),
    );

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.enrolOutside,
        to: LINES.enrolOutside,
        body: address,
        messageSid: `SM-${task.id}-outside`,
      }),
    );

    expect(result).toEqual({ message: 'address outside' });
    expect(recordedSms.at(-1)?.body).toBe(
      `That address is outside the districts of "${name}", so you cannot register for it.`,
    );
  });

  it('given a member who was sent the attestation texts AGREE, then they are registered and the row is enrolled', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Enrol Agree ${task.id}`;
    const { member, instanceId } = await seed(fixture, {
      phone: NUMBERS.enrolAgree,
      line: LINES.enrolAgree,
      name,
    });
    const address = `375 S High St ${task.id}`;
    memoryGeocoder.set(address, INSIDE);
    await run(
      smsInboundEvent({
        from: NUMBERS.enrolAgree,
        to: LINES.enrolAgree,
        keyword: 'vote',
      }),
    );
    await run(
      smsInboundEvent({
        from: NUMBERS.enrolAgree,
        to: LINES.enrolAgree,
        body: address,
        messageSid: `SM-${task.id}-address`,
      }),
    );

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.enrolAgree,
        to: LINES.enrolAgree,
        keyword: 'agree',
      }),
    );

    expect(result).toEqual({ message: 'enrolled' });
    expect(recordedSms.at(-1)?.body).toBe(
      `You're registered to vote in "${name}".`,
    );
    const row = await findVoterEnrolment({
      processInstanceId: instanceId,
      authUserId: member.authUserId,
    });
    expect(row?.enrolledAt).not.toBeNull();
  });

  it('given a member with no registration in progress texts AGREE, then they are told there is nothing to affirm', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.agreeNothing,
      line: null,
      name: `Agree Nothing ${task.id}`,
    });

    const { result } = await run(
      smsInboundEvent({ from: NUMBERS.agreeNothing, keyword: 'agree' }),
    );

    expect(result).toEqual({ message: 'nothing to affirm' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'There is nothing to affirm. Text VOTE and a decision name to register.',
    ]);
  });

  it('given a member texts VOTE and the slug of a decision with no registration step, then they are told none is needed', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Vote No Rule ${task.id}`;
    const { slug } = await seed(fixture, {
      phone: NUMBERS.voteNoRule,
      line: null,
      name,
      withRule: false,
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.voteNoRule,
        keyword: 'vote',
        argument: slug,
      }),
    );

    expect(result).toEqual({ message: 'no enrolment needed' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `No registration is needed for "${name}". Voting is open.`,
    ]);
  });

  it('given a member with no registration in progress texts free text, then they get the help reply as before', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.freeNothing,
      line: null,
      name: `Free Nothing ${task.id}`,
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.freeNothing,
        body: 'hello there',
        messageSid: `SM-${task.id}-hello`,
      }),
    );

    expect(result).toEqual({ message: 'help sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      SMS_COMMAND_HELP_MESSAGE,
    ]);
  });

  it('given a member texts VOTE alone to the shared number, then they are asked for a decision name', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.voteNoSlug,
      line: null,
      name: `Vote No Slug ${task.id}`,
    });

    const { result } = await run(
      smsInboundEvent({ from: NUMBERS.voteNoSlug, keyword: 'vote' }),
    );

    expect(result).toEqual({ message: 'vote needs a decision' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'Text VOTE and a decision name, for example VOTE columbus.',
    ]);
  });

  it("given a registered member whose decision's attestation was rewritten, when they text VOTE, then they are still registered because enrolment records only the time", async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Enrol Rewrite ${task.id}`;
    const member = await fixture.createPhoneOnlyAccount(
      parsePhoneNumber(NUMBERS.enrolRewrite),
    );
    const { instanceId, instanceProfileId } =
      await fixture.createVotingInstance({
        owner: member,
        name,
        proposalTitles: ['Crosswalk lighting'],
        enrolment: { attestation: ATTESTATION, boundary: true },
        ownerIsAdmin: true,
      });
    await fixture.createDistrict({
      profileId: instanceProfileId,
      name: `District 5 ${name}`,
    });
    await fixture.bindLine(instanceId, parsePhoneNumber(LINES.enrolRewrite));
    const address = `375 S High St ${task.id}`;
    memoryGeocoder.set(address, INSIDE);
    const text = (
      event: Omit<Parameters<typeof smsInboundEvent>[0], 'from' | 'to'>,
    ) =>
      run(
        smsInboundEvent({
          from: NUMBERS.enrolRewrite,
          to: LINES.enrolRewrite,
          ...event,
        }),
      );
    await text({ keyword: 'vote' });
    await text({ body: address, messageSid: `SM-${task.id}-address` });
    await text({ keyword: 'agree', messageSid: `SM-${task.id}-agree` });
    await fixture.rewriteAttestation({
      instanceId,
      owner: member,
      attestation: `I affirm the rewritten requirements ${task.id}.`,
    });

    const again = await text({
      keyword: 'vote',
      messageSid: `SM-${task.id}-vote-again`,
    });

    expect(again.result).toEqual({ message: 'already enrolled' });
    expect(recordedSms.at(-1)?.body).toBe(
      `You're registered to vote in "${name}".`,
    );
    const row = await findVoterEnrolment({
      processInstanceId: instanceId,
      authUserId: member.authUserId,
    });
    expect(row?.enrolledAt).not.toBeNull();
  });

  it("given a member asked for an address by one decision, when they text VOTE and another decision's slug to the first one's line and then an address, then the address registers them for the decision they named", async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const first = await seed(fixture, {
      phone: NUMBERS.enrolSwitch,
      line: LINES.enrolSwitch,
      name: `Enrol First ${task.id}`,
    });
    const other = await fixture.createVotingInstance({
      owner: first.member,
      name: `Enrol Other ${task.id}`,
      proposalTitles: ['Bike racks'],
      enrolment: { attestation: ATTESTATION, boundary: true },
    });
    await fixture.addMember(other.instanceProfileId, first.member);
    const otherDistrict = await fixture.createDistrict({
      profileId: other.instanceProfileId,
      name: `Other District ${task.id}`,
    });
    const address = `375 S High St ${task.id}`;
    memoryGeocoder.set(address, INSIDE);
    const text = (
      event: Omit<Parameters<typeof smsInboundEvent>[0], 'from' | 'to'>,
    ) =>
      run(
        smsInboundEvent({
          from: NUMBERS.enrolSwitch,
          to: LINES.enrolSwitch,
          ...event,
        }),
      );
    await text({ keyword: 'vote' });

    await text({
      keyword: 'vote',
      argument: other.slug,
      messageSid: `SM-${task.id}-vote-other`,
    });
    const { result } = await text({
      body: address,
      messageSid: `SM-${task.id}-address`,
    });

    expect(result).toEqual({ message: 'address resolved' });
    await expect(
      findVoterEnrolment({
        processInstanceId: other.instanceId,
        authUserId: first.member.authUserId,
      }),
    ).resolves.toMatchObject({
      taxonomyTermId: otherDistrict.taxonomyTermId,
      enrolledAt: null,
    });
    await expect(
      findVoterEnrolment({
        processInstanceId: first.instanceId,
        authUserId: first.member.authUserId,
      }),
    ).resolves.toMatchObject({
      taxonomyTermId: null,
      enrolledAt: null,
    });
  });
});

describe('handleSMSCommand browsing the ballot', () => {
  const PROPOSALS = [
    { title: 'Crosswalk lighting', budget: 85_000 },
    { title: 'Bike lane', budget: 310_000 },
    { title: 'Speed humps', budget: 45_000 },
    { title: 'Bus shelters', budget: 60_000 },
    { title: 'Alley lighting', budget: 120_000 },
    { title: 'Tree planting', budget: 150_000 },
  ];
  const FIRST_PAGE_LINES = [
    '101 Crosswalk lighting ($85,000)',
    '102 Bike lane ($310,000)',
    '103 Speed humps ($45,000)',
    '104 Bus shelters ($60,000)',
    '105 Alley lighting ($120,000)',
  ];

  const seed = async (
    fixture: SmsCommandFixture,
    {
      phone,
      line,
      name,
      enrolment,
      currentPhaseId,
    }: {
      phone: string;
      line: string | null;
      name: string;
      enrolment?: { attestation: string; boundary: boolean };
      currentPhaseId?: string;
    },
  ) => {
    const member = await fixture.createPhoneOnlyAccount(
      parsePhoneNumber(phone),
    );
    const { instanceId, instanceProfileId, slug } =
      await fixture.createVotingInstance({
        owner: member,
        name,
        proposalTitles: PROPOSALS,
        ...(enrolment ? { enrolment } : {}),
        ...(currentPhaseId ? { currentPhaseId } : {}),
      });
    await fixture.addMember(instanceProfileId, member);
    if (line) {
      await fixture.bindLine(instanceId, parsePhoneNumber(line));
    }
    return { member, instanceId, slug };
  };

  const run = (event: ReturnType<typeof smsInboundEvent>) =>
    new InngestTestEngine({ function: handleSMSCommand }).execute({
      events: [event],
    });

  it('given a member texts PROPOSALS to the line of a decision with six proposals, then the first five arrive with codes and costs and a MORE footer', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Browse First ${task.id}`;
    await seed(fixture, {
      phone: NUMBERS.browseFirst,
      line: LINES.browseFirst,
      name,
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.browseFirst,
        to: LINES.browseFirst,
        keyword: 'proposals',
      }),
    );

    expect(result).toEqual({ message: 'ballot page sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      [
        `"${name}" has 6 proposals. First 5:`,
        ...FIRST_PAGE_LINES,
        'Reply MORE for the rest, or INFO plus a code.',
      ].join('\n'),
    ]);
  });

  it('given a member has seen the first page, when they text MORE, then the last proposal arrives and the footer no longer offers MORE', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.browseMore,
      line: LINES.browseMore,
      name: `Browse More ${task.id}`,
    });
    await run(
      smsInboundEvent({
        from: NUMBERS.browseMore,
        to: LINES.browseMore,
        keyword: 'proposals',
      }),
    );

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.browseMore,
        to: LINES.browseMore,
        keyword: 'more',
      }),
    );

    expect(result).toEqual({ message: 'next ballot page sent' });
    expect(recordedSms.at(-1)?.body).toBe(
      'Next 1:\n106 Tree planting ($150,000)\nReply INFO plus a code for details.',
    );
  });

  it('given a member who has not browsed texts MORE, then they are told to text PROPOSALS first', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.browseNoCursor,
      line: null,
      name: `Browse No Cursor ${task.id}`,
    });

    const { result } = await run(
      smsInboundEvent({ from: NUMBERS.browseNoCursor, keyword: 'more' }),
    );

    expect(result).toEqual({ message: 'browse not started' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'Text PROPOSALS to start browsing.',
    ]);
  });

  it('given a member texts INFO and a code on the line, then that proposal arrives with its cost and summary', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.infoFound,
      line: LINES.infoFound,
      name: `Info Found ${task.id}`,
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.infoFound,
        to: LINES.infoFound,
        keyword: 'info',
        argument: '101',
      }),
    );

    expect(result).toEqual({ message: 'proposal info sent' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      '101 "Crosswalk lighting" ($85,000)\nNo summary.',
    ]);
  });

  it('given a member texts INFO and a code no proposal has, then they are told it is not on their ballot', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    await seed(fixture, {
      phone: NUMBERS.infoUnknown,
      line: LINES.infoUnknown,
      name: `Info Unknown ${task.id}`,
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.infoUnknown,
        to: LINES.infoUnknown,
        keyword: 'info',
        argument: '999',
      }),
    );

    expect(result).toEqual({ message: 'proposal not on ballot' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      'No proposal with code 999 is on your ballot.',
    ]);
  });

  it('given a decision that requires registration, when an unregistered member texts PROPOSALS, then they are told to text VOTE first', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Browse Unenrolled ${task.id}`;
    await seed(fixture, {
      phone: NUMBERS.browseUnenrolled,
      line: LINES.browseUnenrolled,
      name,
      enrolment: { attestation: 'I affirm.', boundary: false },
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.browseUnenrolled,
        to: LINES.browseUnenrolled,
        keyword: 'proposals',
      }),
    );

    expect(result).toEqual({ message: 'register first' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `Text VOTE to register for "${name}" before browsing its proposals.`,
    ]);
  });

  it('given a decision still taking submissions, when a member texts PROPOSALS, then they are told voting is not open', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const name = `Browse Closed ${task.id}`;
    await seed(fixture, {
      phone: NUMBERS.browseClosed,
      line: LINES.browseClosed,
      name,
      currentPhaseId: 'submission',
    });

    const { result } = await run(
      smsInboundEvent({
        from: NUMBERS.browseClosed,
        to: LINES.browseClosed,
        keyword: 'proposals',
      }),
    );

    expect(result).toEqual({ message: 'voting closed' });
    expect(recordedSms.map((sms) => sms.body)).toEqual([
      `Voting is not open for "${name}".`,
    ]);
  });
});
