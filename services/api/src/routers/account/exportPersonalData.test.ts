import { collectPersonalData } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  customFormSubmissions,
  customForms,
  posts,
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
