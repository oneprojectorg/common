import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
} from '@op/common';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsListCommand } from './handleSmsListCommand';

const NUMBERS = {
  member: '+15005550050',
  publicOnly: '+15005550053',
  nobody: '+15005550051',
  stranger: '+15005550052',
} as const;

const listCommand = (from: PhoneNumber) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-list-${from}`,
    code: null,
    keyword: 'list' as const,
    argument: null,
  },
});

beforeEach(() => {
  memorySmsProvider.reset();
});

describe('handleSmsListCommand against the database', () => {
  it('given a member of two decisions texts LIST, then they are texted both by name and slug, with voting marked where it is open, and not a decision they are outside of', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.member);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const other = await fixture.createEmailAccount();
    const voting = await fixture.createVotingInstance({
      owner: other,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
      name: `Park Funding ${task.id}`,
    });
    const submitting = await fixture.createVotingInstance({
      owner: other,
      maxVotesPerMember: 1,
      proposalTitles: [],
      name: `Bike Lanes ${task.id}`,
      currentPhaseId: 'submission',
    });
    const outside = await fixture.createVotingInstance({
      owner: other,
      maxVotesPerMember: 1,
      proposalTitles: [],
      name: `Outside ${task.id}`,
    });
    await fixture.addMember(voting.instanceProfileId, member);
    await fixture.addMember(submitting.instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSmsListCommand });

    const { result } = await t.execute({ events: [listCommand(phone)] });

    expect(result).toEqual({ message: 'list sent', count: 2 });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: [
          'Your decisions:',
          `Bike Lanes ${task.id} - VOTE ${submitting.slug}`,
          `Park Funding ${task.id} (voting open) - VOTE ${voting.slug}`,
        ].join('\n'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(memorySmsProvider.sent[0]!.body).not.toContain(outside.slug);
  });

  it('given a public decision the account is not a member of, when they text LIST, then it is listed', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.publicOnly);
    await fixture.createPhoneOnlyAccount(phone);
    const owner = await fixture.createEmailAccount();
    const open = await fixture.createVotingInstance({
      owner,
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park'],
      name: `Columbus ${task.id}`,
    });
    const closed = await fixture.createVotingInstance({
      owner,
      maxVotesPerMember: 1,
      proposalTitles: [],
      name: `Private ${task.id}`,
    });
    await fixture.makePublic(open.instanceProfileId);
    const t = new InngestTestEngine({ function: handleSmsListCommand });

    const { result } = await t.execute({ events: [listCommand(phone)] });

    expect(result).toEqual({ message: 'list sent', count: 1 });
    expect(memorySmsProvider.sent[0]!.body).toBe(
      [
        'Your decisions:',
        `Columbus ${task.id} (voting open) - VOTE ${open.slug}`,
      ].join('\n'),
    );
    expect(memorySmsProvider.sent[0]!.body).not.toContain(closed.slug);
  });

  it('given an account that is in no decision texts LIST, then they are told so', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.nobody);
    await fixture.createPhoneOnlyAccount(phone);
    const t = new InngestTestEngine({ function: handleSmsListCommand });

    const { result } = await t.execute({ events: [listCommand(phone)] });

    expect(result).toEqual({ message: 'list sent', count: 0 });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: 'You are not a participant in any decision yet.',
        providerMessageId: expect.any(String),
      },
    ]);
  });

  it('given a number with no account texts LIST, then nothing is sent', async () => {
    const phone = parsePhoneNumber(NUMBERS.stranger);
    const t = new InngestTestEngine({ function: handleSmsListCommand });

    const { result } = await t.execute({ events: [listCommand(phone)] });

    expect(result).toEqual({ message: 'unknown number, skipped' });
    expect(memorySmsProvider.sent).toEqual([]);
  });
});
