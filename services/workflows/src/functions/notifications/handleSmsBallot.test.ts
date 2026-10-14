import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  createAutomatedFlag,
  parsePhoneNumber,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProposalStatus,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  moderationFlags,
  profiles,
  proposals as proposalsTable,
} from '@op/db/schema';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { recordedOtel } from '../../../testing/mocks/otel';
import {
  optOutNumber,
  recordedSms,
  resetRecordedSms,
} from '../../../testing/mocks/sms';
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
  reader: '+15005550077',
  browseOther: '+15005550078',
  strayMore: '+15005550079',
  pages: '+15005550082',
  optedOut: '+15005550084',
  deletedDecision: '+15005550085',
  turnLimit: '+15005550086',
  stalePick: '+15005550087',
  flaggedYes: '+15005550088',
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

const SIX_PROPOSALS = [
  ...PROPOSALS,
  { title: 'Riverside bike lane', budget: 60_000 },
  { title: 'Library late hours', budget: 30_000 },
  { title: 'Market street benches', budget: 12_000 },
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
  recordedOtel.reset();
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
    expect(recordedOtel.events('sms.ballot.ended')).toEqual([
      expect.objectContaining({
        attributes: expect.objectContaining({
          outcome: 'ballot submitted',
          processInstanceId: instanceId,
          authUserId: voter.authUserId,
          picks: 1,
        }),
      }),
    ]);
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

  it('given several proposals, when the voter texts two codes, reviews and submits, then both picks are recorded and the confirmation lists them in texted order', async ({
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
    const recorded = (await readVotes(instanceId)).map(
      (vote) => vote.proposalId,
    );
    expect(recorded).toHaveLength(2);
    expect(recorded).toEqual(
      expect.arrayContaining([proposals[2]!.id, proposals[0]!.id]),
    );
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

  it('given the voter browses another decision with PROPOSALS and its slug, then the ballot leaves that text to the command and answers a later MORE with the guidance', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(
      fixture,
      NUMBERS.browseOther,
      { maxVotesPerMember: 3, proposals: PROPOSALS },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { keyword: 'proposals', argument: 'other-decision' }),
        reply(phone, 2, { keyword: 'more' }),
        silence(3),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot expired', picks: 0 });
    const [welcome, guidance, expired, ...rest] = bodies();
    expect(welcome).toContain('Voting is open');
    expect(guidance).toBe(
      'Text a proposal code to add a pick, LIST to see your ballot, or DONE to review.',
    );
    expect(expired).toContain('was not submitted');
    expect(rest).toEqual([]);
  });

  it('given no proposals page is open, when the voter texts MORE, then they get the guidance', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(
      fixture,
      NUMBERS.strayMore,
      { maxVotesPerMember: 3, proposals: PROPOSALS },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [reply(phone, 1, { keyword: 'more' }), silence(2)],
    });

    const [, guidance] = bodies();
    expect(guidance).toBe(
      'Text a proposal code to add a pick, LIST to see your ballot, or DONE to review.',
    );
  });

  it('given six proposals, when the voter texts PROPOSALS, then every page of the ballot is sent at once', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(fixture, NUMBERS.pages, {
      maxVotesPerMember: 3,
      proposals: SIX_PROPOSALS,
    });
    const t = new InngestTestEngine({ function: handleSmsBallot });

    await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [reply(phone, 1, { keyword: 'proposals' }), silence(2)],
    });

    const [, first, next, expired] = bodies();
    expect(first).toContain(
      `"Park Funding ${NUMBERS.pages}" has 6 proposals. First 5:`,
    );
    expect(first).not.toContain('MORE');
    expect(next).toContain('Next 1:');
    expect(next).toContain('106 Market street benches $12k');
    expect(next).toContain('Text a code to add it to your ballot');
    expect(expired).toContain('was not submitted');
  });

  it('given the voter opts out after the welcome, when their next text cannot be answered, then the ballot stops and sends nothing more', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId } = await seed(fixture, NUMBERS.optedOut, {
      maxVotesPerMember: 3,
      proposals: PROPOSALS,
    });
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        {
          id: 'wait-for-reply-1',
          handler: () => {
            optOutNumber(phone);
            return reply(phone, 1, { codes: ['101'] }).handler();
          },
        },
      ],
    });

    expect(result).toEqual({
      message: 'send rejected',
      reason: 'opted_out',
      picks: 1,
    });
    expect(bodies()).toHaveLength(1);
    expect(await readVotes(instanceId)).toEqual([]);
  });

  it('given the decision is deleted between the ballot check and the submit (the check is stubbed: nothing else can slip a deletion into that gap), when the voter submits, then they are told the ballot could not be recorded', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, instanceProfileId, proposals } =
      await seed(fixture, NUMBERS.deletedDecision, {
        maxVotesPerMember: 1,
        proposals: [PROPOSALS[0]!],
      });
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { keyword: 'yes' }),
        {
          id: 'check-picks-1',
          handler: async () => {
            await db.delete(profiles).where(eq(profiles.id, instanceProfileId));
            return [proposals[0]!.id];
          },
        },
      ],
    });

    expect(result).toMatchObject({ message: 'ballot rejected' });
    expect(bodies().at(-1)).toContain('We could not record your ballot');
  });

  it('given the voter uses up every turn without submitting, then they are told the ballot was not submitted and how to start again', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, slug } = await seed(
      fixture,
      NUMBERS.turnLimit,
      { maxVotesPerMember: 3, proposals: PROPOSALS },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: Array.from({ length: 40 }, (_, index) =>
        reply(phone, index + 1, { keyword: 'list' }),
      ),
    });

    expect(result).toEqual({ message: 'ballot abandoned', picks: 0 });
    expect(bodies().at(-1)).toBe(
      `Your ballot for "Park Funding ${NUMBERS.turnLimit}" was not submitted. Text VOTE ${slug} to start again.`,
    );
    expect(await readVotes(instanceId)).toEqual([]);
  });

  it('given a pick is rejected while the ballot is open (rejected directly: the fixture holds no admin session), when the voter submits, then that pick is dropped and named, and the rest can be submitted', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, proposals } = await seed(
      fixture,
      NUMBERS.stalePick,
      { maxVotesPerMember: 3, proposals: PROPOSALS },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        reply(phone, 1, { codes: ['101', '102'] }),
        {
          id: 'wait-for-reply-2',
          handler: async () => {
            await db
              .update(proposalsTable)
              .set({ status: ProposalStatus.REJECTED })
              .where(eq(proposalsTable.id, proposals[0]!.id));
            return reply(phone, 2, { keyword: 'submit' }).handler();
          },
        },
        reply(phone, 3, { keyword: 'submit' }),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot submitted' });
    const [, , dropped] = bodies();
    expect(dropped).toBe(
      '"Fifth Ave crosswalk lighting" is no longer on the ballot and was removed. 2 picks left. Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
    );
    expect(
      (await readVotes(instanceId)).map((vote) => vote.proposalId),
    ).toEqual([proposals[1]!.id]);
  });

  it('given the only proposal is flagged for moderation while the ballot is open, when the voter replies YES, then no vote is recorded and they are told it left the ballot', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phone, voter, instanceId, proposals } = await seed(
      fixture,
      NUMBERS.flaggedYes,
      { maxVotesPerMember: 1, proposals: [PROPOSALS[0]!] },
    );
    const t = new InngestTestEngine({ function: handleSmsBallot });

    const { result } = await t.execute({
      events: [ballotRequest(instanceId, voter.authUserId, phone)],
      steps: [
        {
          id: 'wait-for-reply-1',
          handler: async () => {
            const { flag } = await createAutomatedFlag({
              itemType: 'proposal',
              itemId: proposals[0]!.id,
            });
            onTestFinished(async () => {
              await db
                .delete(moderationFlags)
                .where(eq(moderationFlags.id, flag.id));
            });
            return reply(phone, 1, { keyword: 'yes' }).handler();
          },
        },
        silence(2),
      ],
    });

    expect(result).toMatchObject({ message: 'ballot expired', picks: 0 });
    expect(bodies()[1]).toBe(
      '"Fifth Ave crosswalk lighting" is no longer on the ballot and was removed. Your ballot is empty. Text a code to add a pick, or PROPOSALS to browse.',
    );
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

  it('given a public decision that is open to read but not to vote, when a ballot is requested for a non-member, then no text is sent', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.reader);
    const reader = await fixture.createPhoneOnlyAccount(phone);
    const owner = await fixture.createEmailAccount();
    const { instanceId, instanceProfileId } =
      await fixture.createVotingInstance({
        owner,
        maxVotesPerMember: 1,
        proposalTitles: PROPOSALS,
        name: `Park Funding ${NUMBERS.reader}`,
      });
    await fixture.makePublic(instanceProfileId, { vote: false });

    const { result } = await new InngestTestEngine({
      function: handleSmsBallot,
    }).execute({
      events: [ballotRequest(instanceId, reader.authUserId, phone)],
    });

    expect(result).toEqual({ message: 'not allowed to vote' });
    expect(recordedOtel.events('sms.ballot.ended')).toEqual([
      expect.objectContaining({
        attributes: expect.objectContaining({
          outcome: 'not allowed to vote',
          processInstanceId: instanceId,
          authUserId: reader.authUserId,
          picks: 0,
        }),
      }),
    ]);
    expect(recordedSms).toEqual([]);
    expect(await readVotes(instanceId)).toEqual([]);
  });
});
