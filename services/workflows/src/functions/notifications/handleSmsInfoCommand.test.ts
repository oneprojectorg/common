import { InngestTestEngine } from '@inngest/test';
import { type PhoneNumber, parsePhoneNumber } from '@op/common';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { recordedSms, resetRecordedSms } from '../../../testing/mocks/sms';
import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsInfoCommand } from './handleSmsInfoCommand';

const NUMBERS = { member: '+15005550090', wrongCode: '+15005550091' } as const;

const infoCommand = (from: PhoneNumber, argument: string) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from,
    messageSid: `SM-info-${from}`,
    code: null,
    keyword: 'info' as const,
    argument,
    codes: [],
  },
});

beforeEach(() => {
  resetRecordedSms();
});

describe('handleSmsInfoCommand against the database', () => {
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
    const t = new InngestTestEngine({ function: handleSmsInfoCommand });

    const { result } = await t.execute({
      events: [infoCommand(phone, `${slug} 102`)],
    });

    expect(result).toEqual({ message: 'info sent' });
    expect(recordedSms[0]!.body).toBe(
      '102: "Cleveland Ave protected bike lane" ($310,000). A curb-protected lane between Morse Rd and Innis Ave. Text 102 to add it to your ballot.',
    );
  });

  it('given a code no proposal has, then the member is told and pointed at PROPOSALS', async ({
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
    const t = new InngestTestEngine({ function: handleSmsInfoCommand });

    const { result } = await t.execute({
      events: [infoCommand(phone, `${slug} 999`)],
    });

    expect(result).toEqual({ message: 'proposal not found' });
    expect(recordedSms[0]!.body).toContain(`PROPOSALS ${slug}`);
  });
});
