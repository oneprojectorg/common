import { db, eq, inArray } from '@op/db/client';
import {
  ModerationFlagStatus,
  ModerationItemType,
  ModerationSource,
  Visibility,
  moderationFlags,
  posts,
  proposals,
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
  ) => {
    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, itemId));
    });
    return db.insert(moderationFlags).values({
      itemType,
      itemId,
      status: ModerationFlagStatus.FLAGGED,
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

      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

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

      const proposal = await testData.createProposal({
        userEmail: submitter.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal to flag', description: 'An idea' },
      });

      // A freshly created proposal is visible; make that explicit so the test
      // isolates the moderation gate from any phase hidden-by-default rule.
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
  });
});
