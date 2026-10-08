import { InngestTestEngine } from '@inngest/test';
import { parsePhoneNumber } from '@op/common';
import { Events, inngest } from '@op/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SmsVotingFixture,
  VOTING_PHASE_ID,
} from '../../../testing/smsVotingFixture';
import { sendPhaseTransitionNotification } from './sendPhaseTransitionNotification';

const NUMBERS = {
  singleProposal: '+15005550030',
  twoProposals: '+15005550031',
  multiChoice: '+15005550032',
  emailFailure: '+15005550033',
} as const;

const transition = (processInstanceId: string) => ({
  name: Events.phaseTransitioned.name,
  data: {
    processInstanceId,
    fromPhaseId: 'submission',
    toPhaseId: VOTING_PHASE_ID,
  },
});

const emailsSent = { id: 'send-emails', handler: () => ({ sent: 1 }) };

const emailsFailed = {
  id: 'send-emails',
  handler: () => {
    throw new Error('Phase transition email batch failed for 1 recipient(s)');
  },
};

const sentEvents = () =>
  vi
    .mocked(inngest.send)
    .mock.calls.flatMap(([payload]) =>
      Array.isArray(payload) ? payload : [payload],
    );

const seedInstance = async (
  fixture: SmsVotingFixture,
  number: string,
  {
    maxVotesPerMember,
    proposalTitles,
  }: { maxVotesPerMember: number; proposalTitles: string[] },
) => {
  const owner = await fixture.createEmailAccount();
  const phoneOnly = await fixture.createPhoneOnlyAccount(
    parsePhoneNumber(number),
  );
  const { instanceId, instanceProfileId, proposals } =
    await fixture.createVotingInstance({
      owner,
      maxVotesPerMember,
      proposalTitles,
    });
  await fixture.addMember(instanceProfileId, owner);
  await fixture.addMember(instanceProfileId, phoneOnly);
  return { owner, phoneOnly, instanceId, proposals };
};

beforeEach(() => {
  vi.spyOn(inngest, 'send').mockResolvedValue({ ids: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendPhaseTransitionNotification against the database', () => {
  it('given a single-choice voting phase with one eligible proposal, when it opens, then every phone-only member is asked to vote by text and email members are not', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phoneOnly, instanceId, proposals } = await seedInstance(
      fixture,
      NUMBERS.singleProposal,
      { maxVotesPerMember: 1, proposalTitles: ['Fund the park'] },
    );
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({
      events: [transition(instanceId)],
      steps: [emailsSent],
    });

    expect(result).toEqual({
      message: '1 phase transition notification(s) sent',
    });
    expect(sentEvents()).toEqual([
      {
        name: Events.voteSmsPromptRequested.name,
        data: {
          processInstanceId: instanceId,
          proposalId: proposals[0]!.id,
          authUserId: phoneOnly.authUserId,
          phone: NUMBERS.singleProposal,
        },
      },
    ]);
  });

  it('given a single-choice voting phase with two eligible proposals, when it opens, then nobody is asked to vote by text', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { instanceId } = await seedInstance(fixture, NUMBERS.twoProposals, {
      maxVotesPerMember: 1,
      proposalTitles: ['Fund the park', 'Repave the lot'],
    });
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { error } = await t.execute({
      events: [transition(instanceId)],
      steps: [emailsSent],
    });

    expect(error).toBeUndefined();
    expect(sentEvents()).toEqual([]);
  });

  it('given a voting phase that allows more than one selection, when it opens, then nobody is asked to vote by text', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { instanceId } = await seedInstance(fixture, NUMBERS.multiChoice, {
      maxVotesPerMember: 2,
      proposalTitles: ['Fund the park'],
    });
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { error } = await t.execute({
      events: [transition(instanceId)],
      steps: [emailsSent],
    });

    expect(error).toBeUndefined();
    expect(sentEvents()).toEqual([]);
  });

  it('given the email batch fails, when the phase opens, then phone-only members are still asked to vote by text', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsVotingFixture(task.id, onTestFinished);
    const { phoneOnly, instanceId } = await seedInstance(
      fixture,
      NUMBERS.emailFailure,
      {
        maxVotesPerMember: 1,
        proposalTitles: ['Fund the park'],
      },
    );
    const t = new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    });

    const { result } = await t.execute({
      events: [transition(instanceId)],
      steps: [emailsFailed],
    });

    expect(result).toEqual({
      message: '0 phase transition notification(s) sent',
    });
    expect(sentEvents()).toEqual([
      expect.objectContaining({
        name: Events.voteSmsPromptRequested.name,
        data: expect.objectContaining({ authUserId: phoneOnly.authUserId }),
      }),
    ]);
  });
});
