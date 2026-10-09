import { InngestTestEngine } from '@inngest/test';
import { type PhoneNumber, parsePhoneNumber } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { recordedSms, resetRecordedSms } from '../../../testing/mocks/sms';
import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsBallot } from './handleSmsBallot';

const NUMBERS = {
  single: '+15005550070',
  picks: '+15005550071',
  overLimit: '+15005550072',
  browse: '+15005550073',
  silent: '+15005550074',
  votedTwice: '+15005550075',
  unknownCode: '+15005550076',
} as const;

const PROPOSALS = [
  {
    title: 'Fifth Ave crosswalk lighting',
    budget: 85_000,
    summary: 'Lights at the crossing.',
  },
  { title: 'Linden rec center evening hours', budget: 240_000 },
  { title: 'Neighborhood tree planting', budget: 150_000 },
];

const ballotRequest = (
  processInstanceId: string,
  authUserId: string,
  phone: PhoneNumber,
) => ({
  name: Events.voteSmsBallotRequested.name,
  data: { processInstanceId, authUserId, phone },
});

type Reply = {
  keyword?: string | null;
  argument?: string | null;
  codes?: string[];
};

const reply = (
  from: PhoneNumber,
  turn: number,
  { keyword = null, argument = null, codes = [] }: Reply,
) => ({
  id: `wait-for-reply-${turn}`,
  handler: () => ({
    data: {
      from,
      messageSid: `SM-reply-${from}-${turn}`,
      code: null,
      keyword,
      argument,
      codes,
    },
  }),
});

const silence = (turn: number) => ({
  id: `wait-for-reply-${turn}`,
  handler: () => null,
});

const bodies = () => recordedSms.map((message) => message.body);

const readVotes = (processInstanceId: string) =>
  db
    .select({
      submittedByProfileId: decisionsVoteSubmissions.submittedByProfileId,
      proposalId: decisionsVoteProposals.proposalId,
    })
    .from(decisionsVoteSubmissions)
    .innerJoin(
      decisionsVoteProposals,
      eq(decisionsVoteProposals.voteSubmissionId, decisionsVoteSubmissions.id),
    )
    .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));

const seed = async (
  fixture: SmsVotingFixture,
  number: string,
  {
    maxVotesPerMember,
    proposals,
  }: { maxVotesPerMember: number; proposals: typeof PROPOSALS },
) => {
  const phone = parsePhoneNumber(number);
  const voter = await fixture.createPhoneOnlyAccount(phone);
  const instance = await fixture.createVotingInstance({
    owner: voter,
    maxVotesPerMember,
    proposalTitles: proposals,
    name: `Park Funding ${number}`,
  });
  await fixture.addMember(instance.instanceProfileId, voter);
  return { phone, voter, ...instance };
};

beforeEach(() => {
  resetRecordedSms();
});

describe('handleSmsBallot against the database', () => {
  it('given one proposal, when the voter replies YES, then the vote is recorded and confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, proposals } = await seed(
      fixture,
      NUMBERS.single,
      {
        maxVotesPerMember: 1,
        proposals: PROPOSALS.slice(0, 1),
      },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [reply(phone, 1, { keyword: 'yes' })],
    });

    expect(result).toMatchObject({ message: 'ballot submitted' });
    expect(await readVotes(instanceId)).toEqual([
      { submittedByProfileId: voter.profileId, proposalId: proposals[0]!.id },
    ]);
    expect(bodies()).toEqual([
      expect.stringContaining(
        'Reply YES to vote for "Fifth Ave crosswalk lighting" ($85,000)',
      ),
      'Your ballot is in. One ballot per person. How you vote is never public.',
    ]);
  });

  it('given several proposals, when the voter texts two codes, reviews and submits, then both picks are recorded in texted order', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, proposals } = await seed(
      fixture,
      NUMBERS.picks,
      {
        maxVotesPerMember: 3,
        proposals: PROPOSALS,
      },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { codes: ['103', '101'] }),
        reply(phone, 2, { keyword: 'done' }),
        reply(phone, 3, { keyword: 'submit' }),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot submitted' });
    expect(
      (await readVotes(instanceId)).map((vote) => vote.proposalId),
    ).toEqual([proposals[2]!.id, proposals[0]!.id]);
    const [welcome, confirmation, ballot, submitted] = bodies();
    expect(welcome).toContain('You can pick up to 3 proposals');
    expect(confirmation).toContain(
      'Pick 1: "Neighborhood tree planting" ($150,000).',
    );
    expect(confirmation).toContain(
      'Pick 2: "Fifth Ave crosswalk lighting" ($85,000).',
    );
    expect(confirmation).toContain('1 pick left.');
    expect(ballot).toBe(
      [
        `Your ballot for "Park Funding ${NUMBERS.picks}":`,
        '1. Neighborhood tree planting $150,000',
        '2. Fifth Ave crosswalk lighting $85,000',
        'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
      ].join('\n'),
    );
    expect(submitted).toContain('Your ballot is in.');
  });

  it('given a one-pick limit, when the voter texts two codes, then only the first is kept until they remove it and pick again', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, proposals } = await seed(
      fixture,
      NUMBERS.overLimit,
      {
        maxVotesPerMember: 1,
        proposals: PROPOSALS,
      },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { codes: ['101', '102'] }),
        reply(phone, 2, { keyword: 'remove', argument: '101' }),
        reply(phone, 3, { codes: ['102'] }),
        reply(phone, 4, { keyword: 'submit' }),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot submitted' });
    expect(
      (await readVotes(instanceId)).map((vote) => vote.proposalId),
    ).toEqual([proposals[1]!.id]);
    const [, overLimit, removed] = bodies();
    expect(overLimit).toContain(
      'You can pick 1. Reply REMOVE plus a code to make room.',
    );
    expect(overLimit).toContain('Pick 1: "Fifth Ave crosswalk lighting"');
    expect(removed).toContain(
      'Removed "Fifth Ave crosswalk lighting". 1 pick left.',
    );
  });

  it('given the voter browses, when they text PROPOSALS, INFO and LIST, then each is answered inside the ballot', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(fixture, NUMBERS.browse, {
      maxVotesPerMember: 3,
      proposals: PROPOSALS,
    });
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { keyword: 'proposals' }),
        reply(phone, 2, { keyword: 'info', argument: '101' }),
        reply(phone, 3, { keyword: 'list' }),
        silence(4),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot expired', picks: 0 });
    const [, page, info, list, expired] = bodies();
    expect(page).toContain(
      `"Park Funding ${NUMBERS.browse}" has 3 proposals. First 3:`,
    );
    expect(page).toContain('101 Fifth Ave crosswalk lighting $85k');
    expect(page).toContain('102 Linden rec center evening hours $240k');
    expect(info).toBe(
      '101: "Fifth Ave crosswalk lighting" ($85,000). Lights at the crossing. Text 101 to add it to your ballot.',
    );
    expect(list).toContain('Your ballot is empty.');
    expect(expired).toContain('was not submitted');
    expect(await readVotes(instanceId)).toEqual([]);
  });

  it('given the voter never replies, then no vote is recorded and they are told the ballot was not submitted', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(fixture, NUMBERS.silent, {
      maxVotesPerMember: 3,
      proposals: PROPOSALS,
    });
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [silence(1)],
    });

    expect(result).toEqual({ message: 'ballot expired', picks: 0 });
    expect(await readVotes(instanceId)).toEqual([]);
    expect(bodies()).toHaveLength(2);
  });

  it('given an unknown code, then the voter is told and the ballot stays empty', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(
      fixture,
      NUMBERS.unknownCode,
      {
        maxVotesPerMember: 3,
        proposals: PROPOSALS,
      },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { codes: ['999'] }),
        reply(phone, 2, { keyword: 'submit' }),
        silence(3),
      ],
    });

    const [, unknown, empty] = bodies();
    expect(unknown).toBe('No proposal with code 999.');
    expect(empty).toContain('Your ballot is empty.');
    expect(await readVotes(instanceId)).toEqual([]);
  });

  it('given the voter already voted, when they submit again, then the ballot is refused and one vote remains', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(
      fixture,
      NUMBERS.votedTwice,
      {
        maxVotesPerMember: 3,
        proposals: PROPOSALS,
      },
    );
    const event = ballotRequest(instanceId, voter.authUserId, phone);

    await new InngestTestEngine({ function: handleSmsBallot }).execute({
      events: [event],
      steps: [
        reply(phone, 1, { codes: ['101'] }),
        reply(phone, 2, { keyword: 'submit' }),
      ],
    });
    const { result } = await new InngestTestEngine({
      function: handleSmsBallot,
    }).execute({
      events: [event],
      steps: [
        reply(phone, 1, { codes: ['102'] }),
        reply(phone, 2, { keyword: 'submit' }),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot rejected' });
    expect(await readVotes(instanceId)).toHaveLength(1);
    expect(bodies().at(-1)).toContain('We could not record your ballot');
  });
});
