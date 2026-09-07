import { collectPersonalData } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  customFormSubmissions,
  customForms,
  posts,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// One tier below the network gate: the right belongs to the account holder, and
// the service reads nothing but the caller's own rows. An anonymous sign-in has
// a `users` row but is not a data subject with a record to hand over.
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

/**
 * The read behind the endpoint. It lives in `@op/common`, whose Vitest project
 * has no database, and what must be proven is which rows real SQL returns.
 *
 * Every case pairs "the subject's row is present" with "the other person's row
 * is absent": a filter that returns everything passes the first on its own.
 */
describe.concurrent('collectPersonalData', () => {
  // Written directly because `createPostOnProfile` authors as
  // `getCurrentProfileId` and so cannot address the personal profile. The only
  // derived write skipped is the `posts_to_profiles` feed index, which the
  // export does not read.
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

  /**
   * A participant acting as themselves. Pinning `currentProfileId` back to their
   * own profile is what separates this fixture from someone writing on an
   * organisation's behalf, whose rows stay out of the export by design.
   */
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

  // The one place the read looks outside the subject's own profile: a proposal's
  // form submission is filed under the proposal. Reading only their profile
  // drops most of what they wrote; one row too far hands them someone else's.
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

  // The `users` row exists from sign-up; the profile arrives at onboarding.
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

  // Article 20 covers what the subject provided. Which org they last opened and
  // which profile they act as are our records of their session, not their data.
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
