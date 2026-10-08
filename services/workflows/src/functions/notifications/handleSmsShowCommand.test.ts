import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
} from '@op/common';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsShowCommand } from './handleSmsShowCommand';

const NUMBERS = {
  member: '+15005550060',
  publicViewer: '+15005550061',
  outsider: '+15005550062',
  noSlug: '+15005550063',
  stranger: '+15005550064',
} as const;

const showCommand = (from: PhoneNumber, argument: string | null) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-show-${from}`,
    code: null,
    keyword: 'show' as const,
    argument,
  },
});

beforeEach(() => {
  memorySmsProvider.reset();
});

describe('handleSmsShowCommand against the database', () => {
  it('given a member texts SHOW and the decision slug, then they are texted its name and web address', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.member);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      proposalTitles: [],
      name: `Columbus ${task.id}`,
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSmsShowCommand });

    const { result } = await t.execute({ events: [showCommand(phone, slug)] });

    expect(result).toEqual({ message: 'link sent' });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringMatching(
          new RegExp(`^Columbus ${task.id}: https?://.+/decisions/${slug}$`),
        ),
        providerMessageId: expect.any(String),
      },
    ]);
  });

  it('given a public decision the account is not a member of, when they text SHOW, then they get its address', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.publicViewer);
    await fixture.createPhoneOnlyAccount(phone);
    const owner = await fixture.createEmailAccount();
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner,
      maxVotesPerMember: 1,
      proposalTitles: [],
    });
    await fixture.makePublic(instanceProfileId);
    const t = new InngestTestEngine({ function: handleSmsShowCommand });

    const { result } = await t.execute({ events: [showCommand(phone, slug)] });

    expect(result).toEqual({ message: 'link sent' });
    expect(memorySmsProvider.sent[0]!.body).toContain(`/decisions/${slug}`);
  });

  it('given a private decision the account cannot read, when they text SHOW, then it is reported as not found', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.outsider);
    await fixture.createPhoneOnlyAccount(phone);
    const owner = await fixture.createEmailAccount();
    const { slug } = await fixture.createVotingInstance({
      owner,
      maxVotesPerMember: 1,
      proposalTitles: [],
    });
    const t = new InngestTestEngine({ function: handleSmsShowCommand });

    const { result } = await t.execute({ events: [showCommand(phone, slug)] });

    expect(result).toEqual({ message: 'decision not found' });
    expect(memorySmsProvider.sent[0]!.body).not.toContain('/decisions/');
    expect(memorySmsProvider.sent[0]!.body).toContain(slug);
  });

  it('given SHOW with no decision named, then they are told how to name one', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.noSlug);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSmsShowCommand });

    const { result } = await t.execute({ events: [showCommand(phone, null)] });

    expect(result).toEqual({ message: 'help sent' });
    expect(memorySmsProvider.sent[0]!.body).toContain('SHOW');
  });

  it('given a number with no account texts SHOW, then nothing is sent', async () => {
    const phone = parsePhoneNumber(NUMBERS.stranger);
    const t = new InngestTestEngine({ function: handleSmsShowCommand });

    const { result } = await t.execute({
      events: [showCommand(phone, 'columbus')],
    });

    expect(result).toEqual({ message: 'unknown number, skipped' });
    expect(memorySmsProvider.sent).toEqual([]);
  });
});
