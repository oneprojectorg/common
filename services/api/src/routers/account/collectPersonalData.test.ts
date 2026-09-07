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

/**
 * Database-backed tests for the Article 20 export read.
 *
 * `collectPersonalData` lives in `@op/common`, but that package's Vitest project
 * has no database — every test there mocks its boundaries. What has to be proven
 * here is which rows real SQL returns, so the test lives in the workspace that
 * owns the seeded test instance.
 *
 * One property carries all of them: the export holds the calling subject's rows
 * and nobody else's. This is the file where a scoping mistake stops being a bug
 * and becomes a breach, so every case pairs "the subject's row is present" with
 * "the other person's row is absent" — a filter that returns everything passes
 * the first assertion on its own.
 */
describe.concurrent('collectPersonalData', () => {
  // Posts and custom forms are written directly rather than through their
  // services. `createPostOnProfile` authors as `getCurrentProfileId`, which is
  // the profile the user last switched to — the organisation's, for a user who
  // just created one — so it cannot address the personal profile this export is
  // scoped to. The only derived write these inserts skip is the
  // `posts_to_profiles` feed index, which the export does not read.
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
   * A participant who is acting as themselves.
   *
   * The writers this export reads from attribute a row to `getCurrentProfileId`
   * — the profile the person last switched to. A user who has just created an
   * organisation is switched to it, so anything they write lands under the
   * organisation's profile and out of their personal export by design. Pinning
   * `currentProfileId` back to their own profile is what makes these fixtures a
   * participant rather than an organisation, which is the case under test.
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

  // The subquery this pins down is the one place the read deliberately looks
  // outside the subject's own profile. `custom_form_submissions.profileId` is
  // the *target* entity's profile, so the form somebody fills in to submit a
  // proposal is filed under the proposal, not under them. Reading only their own
  // profile would drop the bulk of what they wrote; reaching one row too far
  // would hand them somebody else's answers.
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

  // A `users` row exists from the moment an auth user is created; the personal
  // profile arrives at onboarding. Someone who never finished has an account to
  // export and nothing authored under it, and that is an answer rather than a
  // failure — the alternative is six queries against a null profile id.
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

  // Article 20 covers what the subject provided. `users` carries columns we set
  // about them — which organisation they last opened, which profile they are
  // acting as — and those are our records of their session, not their data. They
  // are also internal ids that would make the file harder to read, not easier.
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
