import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
} from '@op/common';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsProposalsCommand } from './handleSmsProposalsCommand';

const NUMBERS = { browser: '+15005550080', outsider: '+15005550081' } as const;

const proposalsCommand = (from: PhoneNumber, argument: string) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-proposals-${from}`,
    code: null,
    keyword: 'proposals' as const,
    argument,
    codes: [],
  },
});

const more = (from: PhoneNumber, page: number) => ({
  id: `wait-for-more-${page}`,
  handler: () => ({
    data: {
      from,
      messageSid: `SM-more-${from}-${page}`,
      code: null,
      keyword: 'more',
      argument: null,
      codes: [],
    },
  }),
});

beforeEach(() => {
  memorySmsProvider.reset();
});

describe('handleSmsProposalsCommand against the database', () => {
  it('given seven proposals, when a member texts PROPOSALS and the slug, then they get a page of five and the rest after MORE', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.browser);
    const member = await fixture.createPhoneOnlyAccount(phone);
    const { instanceProfileId, slug } = await fixture.createVotingInstance({
      owner: member,
      maxVotesPerMember: 1,
      proposalTitles: Array.from({ length: 7 }, (_, i) => ({
        title: `Proposal ${i + 1}`,
        budget: (i + 1) * 10_000,
      })),
      name: `Browse ${task.id}`,
    });
    await fixture.addMember(instanceProfileId, member);
    const t = new InngestTestEngine({ function: handleSmsProposalsCommand });

    const { result } = await t.execute({
      events: [proposalsCommand(phone, slug)],
      steps: [more(phone, 1)],
    });

    expect(result).toEqual({ message: 'proposals sent', pages: 2 });
    const [first, second] = memorySmsProvider.sent.map(
      (message) => message.body,
    );
    expect(first).toBe(
      [
        `"Browse ${task.id}" has 7 proposals. First 5:`,
        '101 Proposal 1 $10k',
        '102 Proposal 2 $20k',
        '103 Proposal 3 $30k',
        '104 Proposal 4 $40k',
        '105 Proposal 5 $50k',
        'Reply MORE for the next ones, or INFO plus a code.',
      ].join('\n'),
    );
    expect(second).toBe(
      [
        'Next 2:',
        '106 Proposal 6 $60k',
        '107 Proposal 7 $70k',
        'Text a code to add it to your ballot, or INFO plus a code.',
      ].join('\n'),
    );
  });

  it('given a private decision the account cannot read, then it is reported as not found', async ({
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
      proposalTitles: ['Fund the park'],
    });
    const t = new InngestTestEngine({ function: handleSmsProposalsCommand });

    const { result } = await t.execute({
      events: [proposalsCommand(phone, slug)],
    });

    expect(result).toEqual({ message: 'decision not found' });
    expect(memorySmsProvider.sent[0]!.body).toContain(slug);
  });
});
