import { mockCollab, textFragment } from '@op/collab/testing';
import { collectPersonalData, parseProposalData } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  customFormSubmissions,
  customForms,
  posts,
  ProposalStatus,
  proposals,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('account.exportPersonalData', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.account.exportPersonalData(),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.account.exportPersonalData(),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits an out-of-network account holder',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(caller.account.exportPersonalData());
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits an in-network account holder',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      await expectPassesAccessTierGate(caller.account.exportPersonalData());
    },
  ),
});

describe.concurrent('collectPersonalData', () => {
  // Inserted directly: `createPostOnProfile` writes under the current profile.
  const writePost = async (profileId: string, content: string) => {
    const [post] = await db
      .insert(posts)
      .values({ content, profileId })
      .returning();

    if (!post) {
      throw new Error('Test setup: failed to insert post');
    }

    return post;
  };

  const createParticipant = async (
    testData: TestDecisionsDataManager,
    organization: { id: string },
    instanceProfileId: string,
  ) => {
    const member = await testData.createMemberUser({
      organization,
      instanceProfileIds: [instanceProfileId],
    });

    await db
      .update(users)
      .set({ currentProfileId: member.profileId })
      .where(eq(users.authUserId, member.authUserId));

    return member;
  };

  const writeFormSubmission = async (
    profileId: string,
    data: Record<string, unknown>,
  ) => {
    const [form] = await db
      .insert(customForms)
      .values({ profileId, name: `form-${profileId}`, schema: {} })
      .returning();

    if (!form) {
      throw new Error('Test setup: failed to insert custom form');
    }

    const [submission] = await db
      .insert(customFormSubmissions)
      .values({ customFormId: form.id, profileId, data })
      .returning();

    if (!submission) {
      throw new Error('Test setup: failed to insert custom form submission');
    }

    return submission;
  };

  it('holds the subject’s posts and none of another member’s', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const [subject, other] = await Promise.all([
      createParticipant(testData, setup.organization, setup.instance.profileId),
      createParticipant(testData, setup.organization, setup.instance.profileId),
    ]);

    const mine = await writePost(subject.profileId, 'mine');
    const theirs = await writePost(other.profileId, 'theirs');

    const file = await collectPersonalData({ authUserId: subject.authUserId });

    const exportedIds = file.posts.map(({ id }) => id);

    expect(exportedIds).toContain(mine.id);
    expect(exportedIds).not.toContain(theirs.id);
  });

  it('holds the proposals the subject submitted and none of another member’s', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const [subject, other] = await Promise.all([
      createParticipant(testData, setup.organization, setup.instance.profileId),
      createParticipant(testData, setup.organization, setup.instance.profileId),
    ]);

    const [mine, theirs] = await Promise.all([
      testData.createProposal({
        userEmail: subject.email,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Mine', description: 'mine' },
      }),
      testData.createProposal({
        userEmail: other.email,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Theirs', description: 'theirs' },
      }),
    ]);

    const file = await collectPersonalData({ authUserId: subject.authUserId });

    const exportedIds = file.proposals.map(({ id }) => id);

    expect(exportedIds).toContain(mine.id);
    expect(exportedIds).not.toContain(theirs.id);
  });

  it('holds the pinned document text and its title and budget, over the creation-time snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        'x-field-order': ['title', 'budget', 'summary'],
        properties: {
          title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
          budget: {
            type: 'object',
            title: 'Budget',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string', default: 'USD' },
            },
          },
          summary: {
            type: 'string',
            title: 'Summary',
            'x-format': 'long-text',
          },
        },
      },
    });
    const subject = await createParticipant(
      testData,
      setup.organization,
      setup.instance.profileId,
    );

    const proposal = await testData.createProposal({
      userEmail: subject.email,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Stale Title' },
    });

    const proposalData = parseProposalData(proposal.proposalData);
    const { collaborationDocId } = proposalData;

    if (!collaborationDocId) {
      throw new Error('Test setup: proposal has no collaboration document');
    }

    const summary = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Pinned body' }] },
      ],
    };

    mockCollab.setDocFragmentResponses(collaborationDocId, {
      title: textFragment('Live Title'),
      summary: textFragment('Live body'),
    });
    mockCollab.setVersionedDocFragmentResponses(collaborationDocId, 2, {
      title: textFragment('Pinned Title'),
      budget: textFragment('{"amount":500,"currency":"EUR"}'),
      summary,
    });

    await db
      .update(proposals)
      .set({
        status: ProposalStatus.SUBMITTED,
        proposalData: { ...proposalData, collaborationDocVersionId: 2 },
      })
      .where(eq(proposals.id, proposal.id));

    const file = await collectPersonalData({ authUserId: subject.authUserId });

    const [exported] = file.proposals;

    expect(exported?.proposalData).toMatchObject({
      title: 'Pinned Title',
      budget: { amount: 500, currency: 'EUR' },
    });
    expect(exported?.document).toEqual({
      type: 'json',
      fragments: expect.objectContaining({ summary }),
    });
  });

  it('marks a proposal document it could not fetch as unavailable rather than dropping it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const subject = await createParticipant(
      testData,
      setup.organization,
      setup.instance.profileId,
    );

    // No mocked response: the collab server answers 404.
    await testData.createProposal({
      userEmail: subject.email,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Missing Doc' },
    });

    const file = await collectPersonalData({ authUserId: subject.authUserId });

    expect(file.proposals[0]?.document).toEqual({ type: 'unavailable' });
  });

  it('reaches submissions filed against the subject’s own proposals, and stops there', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const [subject, other] = await Promise.all([
      createParticipant(testData, setup.organization, setup.instance.profileId),
      createParticipant(testData, setup.organization, setup.instance.profileId),
    ]);

    const [mine, theirs] = await Promise.all([
      testData.createProposal({
        userEmail: subject.email,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Mine', description: 'mine' },
      }),
      testData.createProposal({
        userEmail: other.email,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Theirs', description: 'theirs' },
      }),
    ]);

    const [onMyProposal, onTheirProposal] = await Promise.all([
      writeFormSubmission(mine.profileId, { answer: 'mine' }),
      writeFormSubmission(theirs.profileId, { answer: 'theirs' }),
    ]);

    const file = await collectPersonalData({ authUserId: subject.authUserId });

    const exportedIds = file.customFormSubmissions.map(({ id }) => id);

    expect(exportedIds).toContain(onMyProposal.id);
    expect(exportedIds).not.toContain(onTheirProposal.id);
  });

  it('exports the account alone when the subject has no personal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    await db
      .update(users)
      .set({ profileId: null })
      .where(eq(users.authUserId, setup.user.id));

    const file = await collectPersonalData({ authUserId: setup.user.id });

    expect(file.user.id).toBeTruthy();
    expect(file.profile).toBeNull();
    expect(file.individual).toBeNull();
    expect(file.posts).toEqual([]);
    expect(file.proposals).toEqual([]);
    expect(file.customFormSubmissions).toEqual([]);
    expect(file.voteSubmissions).toEqual([]);
    expect(file.truncatedSections).toEqual([]);
  });

  it('leaves our own bookkeeping out of the account section', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const file = await collectPersonalData({ authUserId: setup.user.id });

    expect(file.user).not.toHaveProperty('authUserId');
    expect(file.user).not.toHaveProperty('lastOrgId');
    expect(file.user).not.toHaveProperty('currentProfileId');
    expect(file.user).not.toHaveProperty('profileId');
  });
});
