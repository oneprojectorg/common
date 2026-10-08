import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { SmsVotingFixture } from '../../../testing/smsVotingFixture';
import { handleSmsVoteRequest } from './handleSmsVoteRequest';

const NUMBERS = {
  confirms: '+15005550020',
  confirmsLate: '+15005550021',
  silent: '+15005550022',
  neverConfirms: '+15005550023',
  unknownProposal: '+15005550024',
  votedTwice: '+15005550025',
} as const;

const promptFor = ({
  processInstanceId,
  proposalId,
  authUserId,
  phone,
}: {
  processInstanceId: string;
  proposalId: string;
  authUserId: string;
  phone: PhoneNumber;
}) => ({
  name: Events.voteSmsPromptRequested.name,
  data: { processInstanceId, proposalId, authUserId, phone },
});

const reply = (
  from: PhoneNumber,
  attempt: number,
  keyword: 'yes' | 'join' | null,
) => ({
  id: `wait-for-vote-reply-${attempt}`,
  handler: () => ({
    data: {
      from,
      messageSid: `SM-vote-reply-${from}-${attempt}`,
      code: null,
      keyword,
    },
  }),
});

const silence = (attempt: number) => ({
  id: `wait-for-vote-reply-${attempt}`,
  handler: () => null,
});

const readVotes = (processInstanceId: string) =>
  db
    .select({
      voteSubmissionId: decisionsVoteSubmissions.id,
      submittedByProfileId: decisionsVoteSubmissions.submittedByProfileId,
      proposalId: decisionsVoteProposals.proposalId,
    })
    .from(decisionsVoteSubmissions)
    .innerJoin(
      decisionsVoteProposals,
      eq(decisionsVoteProposals.voteSubmissionId, decisionsVoteSubmissions.id),
    )
    .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));

const seedVoter = async (
  fixture: SmsVotingFixture,
  number: PhoneNumber,
  proposalTitles: string[],
) => {
  const voter = await fixture.createPhoneOnlyAccount(number);
  const { instanceId, instanceProfileId, proposals } =
    await fixture.createVotingInstance({
      owner: voter,
      maxVotesPerMember: 1,
      proposalTitles,
    });
  await fixture.addMember(instanceProfileId, voter);
  return { voter, instanceId, proposals };
};

beforeEach(() => {
  memorySmsProvider.reset();
});

describe('handleSmsVoteRequest against the database', () => {
  it('given a phone-only member is prompted, when they reply YES, then their vote for the proposal is recorded and they are texted a receipt', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.confirms);
    const { voter, instanceId, proposals } = await seedVoter(fixture, phone, [
      'Fund the park',
    ]);
    const proposal = proposals[0]!;
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [
        promptFor({
          processInstanceId: instanceId,
          proposalId: proposal.id,
          authUserId: voter.authUserId,
          phone,
        }),
      ],
      steps: [reply(phone, 1, 'yes')],
    });

    const votes = await readVotes(instanceId);
    expect(votes).toEqual([
      {
        voteSubmissionId: expect.any(String),
        submittedByProfileId: voter.profileId,
        proposalId: proposal.id,
      },
    ]);
    expect(result).toEqual({
      message: 'vote recorded',
      voteSubmissionId: votes[0]!.voteSubmissionId,
    });
    expect(memorySmsProvider.sent).toEqual([
      {
        to: phone,
        body: expect.stringContaining('Fund the park'),
        providerMessageId: expect.any(String),
      },
      {
        to: phone,
        body: expect.stringContaining('Fund the park'),
        providerMessageId: expect.any(String),
      },
    ]);
    expect(memorySmsProvider.sent[0]!.body).toContain('YES');
  });

  it('given a member replies with something else first, when a later reply is YES, then the vote is recorded', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.confirmsLate);
    const { voter, instanceId, proposals } = await seedVoter(fixture, phone, [
      'Repave the lot',
    ]);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [
        promptFor({
          processInstanceId: instanceId,
          proposalId: proposals[0]!.id,
          authUserId: voter.authUserId,
          phone,
        }),
      ],
      steps: [reply(phone, 1, null), reply(phone, 2, 'yes')],
    });

    expect(result).toMatchObject({ message: 'vote recorded' });
    expect(await readVotes(instanceId)).toHaveLength(1);
  });

  it('given a member is prompted, when nobody replies, then no vote is recorded and only the prompt was sent', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.silent);
    const { voter, instanceId, proposals } = await seedVoter(fixture, phone, [
      'Fund the park',
    ]);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [
        promptFor({
          processInstanceId: instanceId,
          proposalId: proposals[0]!.id,
          authUserId: voter.authUserId,
          phone,
        }),
      ],
      steps: [silence(1)],
    });

    expect(result).toEqual({ message: 'timed out waiting for vote reply' });
    expect(await readVotes(instanceId)).toEqual([]);
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
    ]);
  });

  it('given a member never replies YES, when the allowed replies run out, then no vote is recorded', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.neverConfirms);
    const { voter, instanceId, proposals } = await seedVoter(fixture, phone, [
      'Fund the park',
    ]);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [
        promptFor({
          processInstanceId: instanceId,
          proposalId: proposals[0]!.id,
          authUserId: voter.authUserId,
          phone,
        }),
      ],
      steps: [
        reply(phone, 1, null),
        reply(phone, 2, 'join'),
        reply(phone, 3, null),
      ],
    });

    expect(result).toEqual({ message: 'reply did not confirm', attempts: 3 });
    expect(await readVotes(instanceId)).toEqual([]);
  });

  it('given the proposal no longer exists, when prompted, then nothing is sent', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.unknownProposal);
    const { voter, instanceId } = await seedVoter(fixture, phone, [
      'Fund the park',
    ]);
    const t = new InngestTestEngine({ function: handleSmsVoteRequest });

    const { result } = await t.execute({
      events: [
        promptFor({
          processInstanceId: instanceId,
          proposalId: '00000000-0000-4000-8000-000000000000',
          authUserId: voter.authUserId,
          phone,
        }),
      ],
    });

    expect(result).toEqual({ message: 'proposal not found' });
    expect(memorySmsProvider.sent).toEqual([]);
  });

  it('given a member already voted, when they reply YES to a second prompt, then the second vote is rejected and one vote remains', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const phone = parsePhoneNumber(NUMBERS.votedTwice);
    const { voter, instanceId, proposals } = await seedVoter(fixture, phone, [
      'Fund the park',
    ]);
    const event = promptFor({
      processInstanceId: instanceId,
      proposalId: proposals[0]!.id,
      authUserId: voter.authUserId,
      phone,
    });
    const firstRun = new InngestTestEngine({ function: handleSmsVoteRequest });
    const secondRun = new InngestTestEngine({ function: handleSmsVoteRequest });

    await firstRun.execute({
      events: [event],
      steps: [reply(phone, 1, 'yes')],
    });
    const { result } = await secondRun.execute({
      events: [event],
      steps: [reply(phone, 1, 'yes')],
    });

    expect(result).toEqual({
      message: 'vote rejected',
      reason: expect.stringContaining('already submitted'),
    });
    expect(await readVotes(instanceId)).toHaveLength(1);
  });
});
