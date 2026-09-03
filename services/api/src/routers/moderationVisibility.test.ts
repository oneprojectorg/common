import { db, eq, inArray } from '@op/db/client';
import {
  ModerationFlagStatus,
  ModerationItemType,
  ModerationSource,
  ProposalStatus,
  Visibility,
  moderationFlags,
  posts,
  postsToOrganizations,
  proposals,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../test/helpers/TestDecisionsDataManager';
import { TestOrganizationDataManager } from '../test/helpers/TestOrganizationDataManager';
import { createAuthenticatedCaller } from '../test/supabase-utils';

/**
 * End-to-end coverage for the read side of async moderation: once a provider
 * verdict opens a flag on an item, that item drops out of general reads but
 * stays visible — with an `isFlagged` indicator — to the people allowed to act
 * on it (the author and admins). Exercises both filtering mechanisms: the
 * correlated `NOT EXISTS` on the list feeds (posts) and the per-item gate in
 * `getProposal` (proposals).
 */
describe.concurrent('moderation read visibility', () => {
  // Opens an active (hiding) flag the way an upheld provider verdict would, and
  // schedules its removal so the shared item rows stay clean between tests.
  const flagItem = (
    onTestFinished: (fn: () => void | Promise<void>) => void,
    itemType: ModerationItemType,
    itemId: string,
    status: ModerationFlagStatus = ModerationFlagStatus.FLAGGED,
  ) => {
    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, itemId));
    });
    return db.insert(moderationFlags).values({
      itemType,
      itemId,
      status,
      source: ModerationSource.AUTOMATED,
      reason: 'integration-test verdict',
    });
  };

  describe('organization post feed (listPosts)', () => {
    it('hides a flagged post from outsiders but keeps it visible to admins with isFlagged', async ({
      task,
      onTestFinished,
    }) => {
      const hostData = new TestOrganizationDataManager(
        `${task.id}-host`,
        onTestFinished,
      );
      const outsiderData = new TestOrganizationDataManager(
        `${task.id}-out`,
        onTestFinished,
      );

      const { organization, organizationProfile, adminUser } =
        await hostData.createOrganization({ users: { admin: 1 } });
      const { adminUser: outsider } = await outsiderData.createOrganization({
        users: { admin: 1 },
      });

      const adminCaller = await createAuthenticatedCaller(adminUser.email);
      const post = await adminCaller.organization.createPost({
        id: organization.id,
        content: 'Org post that will be flagged.',
      });
      onTestFinished(async () => {
        await db.delete(posts).where(inArray(posts.id, [post.id]));
      });

      // Visible to everyone before the flag opens.
      const outsiderCaller = await createAuthenticatedCaller(outsider.email);
      const before = await outsiderCaller.organization.listPosts({
        slug: organizationProfile.slug,
      });
      expect(before.items.map((item) => item.post.id)).toContain(post.id);

      await flagItem(onTestFinished, ModerationItemType.POST, post.id);

      // Outsider (non-admin, non-author) no longer sees it.
      const outsiderAfter = await outsiderCaller.organization.listPosts({
        slug: organizationProfile.slug,
      });
      expect(outsiderAfter.items.map((item) => item.post.id)).not.toContain(
        post.id,
      );

      // The org admin still sees it, now marked as flagged.
      const adminAfter = await adminCaller.organization.listPosts({
        slug: organizationProfile.slug,
      });
      const adminPost = adminAfter.items.find(
        (item) => item.post.id === post.id,
      );
      expect(adminPost).toBeDefined();
      expect(adminPost?.post.isFlagged).toBe(true);
    });

    it('hides a flagged org post from outsiders in getPost detail but returns it to the org admin with isFlagged', async ({
      task,
      onTestFinished,
    }) => {
      const hostData = new TestOrganizationDataManager(
        `${task.id}-ghost`,
        onTestFinished,
      );
      const outsiderData = new TestOrganizationDataManager(
        `${task.id}-gout`,
        onTestFinished,
      );

      const { organization, adminUser } = await hostData.createOrganization({
        users: { admin: 1 },
      });
      const { adminUser: outsider } = await outsiderData.createOrganization({
        users: { admin: 1 },
      });

      const adminCaller = await createAuthenticatedCaller(adminUser.email);
      const post = await adminCaller.organization.createPost({
        id: organization.id,
        content: 'Org post fetched via getPost.',
      });
      onTestFinished(async () => {
        await db.delete(posts).where(inArray(posts.id, [post.id]));
      });

      await flagItem(onTestFinished, ModerationItemType.POST, post.id);

      // Org admin still resolves the post (via the post's organization),
      // marked flagged.
      const adminView = await adminCaller.posts.getPost({ postId: post.id });
      expect(adminView.id).toBe(post.id);
      expect(adminView.isFlagged).toBe(true);

      // Outsider gets a NotFound (the service returns null, the router 404s) so
      // existence doesn't leak.
      const outsiderCaller = await createAuthenticatedCaller(outsider.email);
      await expect(
        outsiderCaller.posts.getPost({ postId: post.id }),
      ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    });

    it('covers every user type for a flagged post: author + org admin see it, other members do not', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser, memberUsers } =
        await testData.createOrganization({ users: { admin: 1, member: 2 } });
      const author = memberUsers[0];
      const otherMember = memberUsers[1];
      if (!author || !otherMember) {
        throw new Error('Expected two member users');
      }

      // The author exception keys on `posts.profileId === getCurrentProfileId`,
      // which returns the user's *current* profile — resolve it rather than
      // assuming it equals their personal profileId.
      const [authorRow] = await db
        .select({ currentProfileId: users.currentProfileId })
        .from(users)
        .where(eq(users.authUserId, author.authUserId));
      const authorProfileId = authorRow?.currentProfileId ?? author.profileId;

      // A post authored by `author` (its `profileId`) and posted to the org, so
      // the three audiences are distinct: the author, an org admin, and an
      // unrelated member. createPostInOrganization leaves `profileId` null, so
      // insert directly to control authorship.
      const [post] = await db
        .insert(posts)
        .values({
          content: 'Authored post that will be flagged.',
          profileId: authorProfileId,
        })
        .returning();
      if (!post) {
        throw new Error('Failed to insert post');
      }
      onTestFinished(async () => {
        await db.delete(posts).where(inArray(posts.id, [post.id]));
      });
      await db
        .insert(postsToOrganizations)
        .values({ postId: post.id, organizationId: organization.id });

      await flagItem(onTestFinished, ModerationItemType.POST, post.id);

      // Author (owner) sees their own flagged post.
      const authorCaller = await createAuthenticatedCaller(author.email);
      const authorView = await authorCaller.posts.getPost({ postId: post.id });
      expect(authorView.id).toBe(post.id);
      expect(authorView.isFlagged).toBe(true);

      // Org admin (non-author) sees it too.
      const adminCaller = await createAuthenticatedCaller(adminUser.email);
      const adminView = await adminCaller.posts.getPost({ postId: post.id });
      expect(adminView.id).toBe(post.id);
      expect(adminView.isFlagged).toBe(true);

      // A non-author, non-admin member cannot.
      const otherCaller = await createAuthenticatedCaller(otherMember.email);
      await expect(
        otherCaller.posts.getPost({ postId: post.id }),
      ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    });

    it('keeps a contested (disputed) post visible to everyone: contesting a verdict resurfaces it until an admin re-rules', async ({
      task,
      onTestFinished,
    }) => {
      const hostData = new TestOrganizationDataManager(
        `${task.id}-dhost`,
        onTestFinished,
      );
      const outsiderData = new TestOrganizationDataManager(
        `${task.id}-dout`,
        onTestFinished,
      );

      const { organization, organizationProfile, adminUser } =
        await hostData.createOrganization({ users: { admin: 1 } });
      const { adminUser: outsider } = await outsiderData.createOrganization({
        users: { admin: 1 },
      });

      const adminCaller = await createAuthenticatedCaller(adminUser.email);
      const post = await adminCaller.organization.createPost({
        id: organization.id,
        content: 'Org post that will be contested.',
      });
      onTestFinished(async () => {
        await db.delete(posts).where(inArray(posts.id, [post.id]));
      });

      // The owner contested the verdict, so the flag sits in `disputed` awaiting
      // admin re-review. Only a *passed verdict* (`flagged`/`confirmed`) hides;
      // `disputed` does not — the post resurfaces for everyone meanwhile.
      await flagItem(
        onTestFinished,
        ModerationItemType.POST,
        post.id,
        ModerationFlagStatus.DISPUTED,
      );

      // The outsider sees it again, and with no "Flagged" indicator (disputed
      // isn't a hiding status, so it doesn't decorate `isFlagged`).
      const outsiderCaller = await createAuthenticatedCaller(outsider.email);
      const outsiderAfter = await outsiderCaller.organization.listPosts({
        slug: organizationProfile.slug,
      });
      const outsiderPost = outsiderAfter.items.find(
        (item) => item.post.id === post.id,
      );
      expect(outsiderPost).toBeDefined();
      expect(outsiderPost?.post.isFlagged).toBe(false);
    });
  });

  describe('comment thread (getPosts)', () => {
    it('hides a flagged comment from other members in the thread but keeps it visible to the author and admin with isFlagged', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      // The instance admin owns the thread root; the comment hangs off it and
      // resolves to the instance (DECISION) profile as its moderation gate.
      const adminCaller = await createAuthenticatedCaller(setup.userEmail);
      const root = await adminCaller.posts.createPost({
        content: 'Thread root.',
        profileId: instance.profileId,
      });

      const [author, otherMember] = await Promise.all([
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
      ]);

      const authorCaller = await createAuthenticatedCaller(author.email);
      const comment = await authorCaller.posts.createPost({
        content: 'Comment that will be flagged.',
        parentPostId: root.id,
      });

      // Another member with thread access sees the comment before the flag.
      const otherCaller = await createAuthenticatedCaller(otherMember.email);
      const before = await otherCaller.posts.getPosts({
        parentPostId: root.id,
      });
      expect(before.map((post) => post.id)).toContain(comment.id);

      await flagItem(onTestFinished, ModerationItemType.POST, comment.id);

      // The other member no longer sees the flagged comment in the thread.
      const otherAfter = await otherCaller.posts.getPosts({
        parentPostId: root.id,
      });
      expect(otherAfter.map((post) => post.id)).not.toContain(comment.id);

      // The author still sees their own flagged comment, marked flagged.
      const authorAfter = await authorCaller.posts.getPosts({
        parentPostId: root.id,
      });
      const authorComment = authorAfter.find((post) => post.id === comment.id);
      expect(authorComment).toBeDefined();
      expect(authorComment?.isFlagged).toBe(true);

      // The instance admin still sees it, marked flagged.
      const adminAfter = await adminCaller.posts.getPosts({
        parentPostId: root.id,
      });
      const adminComment = adminAfter.find((post) => post.id === comment.id);
      expect(adminComment).toBeDefined();
      expect(adminComment?.isFlagged).toBe(true);
    });
  });

  describe('proposal (getProposal)', () => {
    it('hides a flagged proposal from a non-owner member but keeps it visible to the author and admin with isFlagged', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const instance = setup.instance;

      const [submitter, otherMember] = await Promise.all([
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
      ]);

      // SUBMITTED (not DRAFT) + VISIBLE so a non-owner member can read it
      // pre-flag — this isolates the moderation gate from the draft-only and
      // hidden-by-default visibility gates that run before it in getProposal.
      const proposal = await testData.createProposal({
        userEmail: submitter.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal to flag', description: 'An idea' },
        status: ProposalStatus.SUBMITTED,
      });

      await db
        .update(proposals)
        .set({ visibility: Visibility.VISIBLE })
        .where(eq(proposals.id, proposal.id));

      // The other member can read it before the flag opens.
      const otherCaller = await createAuthenticatedCaller(otherMember.email);
      const before = await otherCaller.decision.getProposal({
        profileId: proposal.profileId,
      });
      expect(before.id).toBe(proposal.id);

      await flagItem(onTestFinished, ModerationItemType.PROPOSAL, proposal.id);

      // Non-owner, non-admin member can no longer see it (NotFound, not
      // Unauthorized, so existence doesn't leak).
      await expect(
        otherCaller.decision.getProposal({ profileId: proposal.profileId }),
      ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

      // The author still sees it, marked flagged.
      const submitterCaller = await createAuthenticatedCaller(submitter.email);
      const authorView = await submitterCaller.decision.getProposal({
        profileId: proposal.profileId,
      });
      expect(authorView.id).toBe(proposal.id);
      expect(authorView.isFlagged).toBe(true);

      // The instance admin still sees it, marked flagged.
      const adminCaller = await createAuthenticatedCaller(setup.userEmail);
      const adminView = await adminCaller.decision.getProposal({
        profileId: proposal.profileId,
      });
      expect(adminView.id).toBe(proposal.id);
      expect(adminView.isFlagged).toBe(true);
    });

    it('keeps the contributing ideas on a flagged proposal loading for the author and admin', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const instance = setup.instance;

      const [submitter, otherMember, adminCaller] = await Promise.all([
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
        createAuthenticatedCaller(setup.userEmail),
      ]);

      const [contributing, survivor] = await Promise.all([
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Contributing idea', description: 'Merges' },
          status: ProposalStatus.SUBMITTED,
        }),
        testData.createProposal({
          userEmail: submitter.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Surviving idea', description: 'Survives' },
          status: ProposalStatus.SUBMITTED,
        }),
      ]);

      // VISIBLE on both ends isolates the moderation gate from the
      // hidden-by-default visibility gate.
      await db
        .update(proposals)
        .set({ visibility: Visibility.VISIBLE })
        .where(inArray(proposals.id, [contributing.id, survivor.id]));

      await adminCaller.decision.mergeProposals({
        sourceProposalId: contributing.id,
        targetProposalId: survivor.id,
      });

      await flagItem(onTestFinished, ModerationItemType.PROPOSAL, survivor.id);

      const submitterCaller = await createAuthenticatedCaller(submitter.email);
      const [authorView, adminView] = await Promise.all([
        submitterCaller.decision.listContributingProposals({
          proposalId: survivor.id,
        }),
        adminCaller.decision.listContributingProposals({
          proposalId: survivor.id,
        }),
      ]);
      expect(authorView.proposals.map((proposal) => proposal.id)).toEqual([
        contributing.id,
      ]);
      expect(adminView.proposals.map((proposal) => proposal.id)).toEqual([
        contributing.id,
      ]);

      const otherCaller = await createAuthenticatedCaller(otherMember.email);
      await expect(
        otherCaller.decision.listContributingProposals({
          proposalId: survivor.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    });

    it('marks a flagged contributing idea as flagged and hides it from other members', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const instance = setup.instance;

      const [otherMember, adminCaller] = await Promise.all([
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
        createAuthenticatedCaller(setup.userEmail),
      ]);

      const [contributing, survivor] = await Promise.all([
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Contributing idea', description: 'Merges' },
          status: ProposalStatus.SUBMITTED,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Surviving idea', description: 'Survives' },
          status: ProposalStatus.SUBMITTED,
        }),
      ]);

      await db
        .update(proposals)
        .set({ visibility: Visibility.VISIBLE })
        .where(inArray(proposals.id, [contributing.id, survivor.id]));

      await adminCaller.decision.mergeProposals({
        sourceProposalId: contributing.id,
        targetProposalId: survivor.id,
      });

      await flagItem(
        onTestFinished,
        ModerationItemType.PROPOSAL,
        contributing.id,
      );

      // The section suppresses the candidacy badges, so without this the
      // card would read as an ordinary contributing idea.
      const adminView = await adminCaller.decision.listContributingProposals({
        proposalId: survivor.id,
      });
      expect(adminView.proposals).toMatchObject([
        { id: contributing.id, isFlagged: true },
      ]);

      const otherCaller = await createAuthenticatedCaller(otherMember.email);
      const otherView = await otherCaller.decision.listContributingProposals({
        proposalId: survivor.id,
      });
      expect(otherView.proposals).toEqual([]);
    });
  });
});
