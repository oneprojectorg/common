import { listProposalMergeRecipients, mergeProposals } from '@op/common';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  authUsers,
  profileUsers,
  proposalRelationships,
  proposals,
  users,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';

/**
 * Overwrite the profileUsers snapshot for one member of a profile. Nothing
 * syncs it after an email change, so a recipient list that reads it delivers
 * to the wrong inbox and fails these tests.
 */
async function staleSnapshot({
  profileId,
  authUserId,
  email,
}: {
  profileId: string;
  authUserId: string;
  email: string;
}): Promise<string> {
  const stale = `stale-${email}`;

  await db
    .update(profileUsers)
    .set({ email: stale })
    .where(
      and(
        eq(profileUsers.profileId, profileId),
        eq(profileUsers.authUserId, authUserId),
      ),
    );

  return stale;
}

/** Add someone to a proposal's profile the way the collaborators panel does. */
async function addCollaborator({
  profileId,
  authUserId,
  email,
}: {
  profileId: string;
  authUserId: string;
  email: string | null;
}): Promise<void> {
  await db.insert(profileUsers).values({ profileId, authUserId, email });
}

/**
 * An admin, two authors, and two proposals in one published instance. The
 * source is authored by `ada`, the target by `grace`, unless a test says
 * otherwise.
 */
async function createMergeSetup(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceProfileId = setup.instance.profileId;
  const instanceId = setup.instance.instance.id;

  const [ada, grace] = await Promise.all([
    testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instanceProfileId],
    }),
    testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instanceProfileId],
    }),
  ]);

  const createProposal = (userEmail: string, title: string) =>
    testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title, description: title },
      // A draft cannot be merged.
      status: ProposalStatus.SUBMITTED,
    });

  const merge = async ({
    sourceProposalId,
    targetProposalId,
    note,
  }: {
    sourceProposalId: string;
    targetProposalId: string;
    note?: string;
  }) => {
    const { relationshipId } = await mergeProposals({
      sourceProposalId,
      targetProposalId,
      note,
      user: setup.user,
    });

    return () =>
      listProposalMergeRecipients({
        relationshipId,
        actorAuthUserId: setup.user.id,
      });
  };

  return { setup, admin: setup.user, ada, grace, createProposal, merge };
}

describe.concurrent('listProposalMergeRecipients', () => {
  it('addresses each side at their sign-in address, not the profileUsers snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, admin, ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Community Garden Revamp'),
      createProposal(grace.email, 'Neighbourhood Green Spaces'),
    ]);
    const [staleAda, staleGrace] = await Promise.all([
      staleSnapshot({
        profileId: source.profileId,
        authUserId: ada.authUserId,
        email: ada.email,
      }),
      staleSnapshot({
        profileId: target.profileId,
        authUserId: grace.authUserId,
        email: grace.email,
      }),
    ]);
    const adminRow = await db.query.users.findFirst({
      where: { authUserId: admin.id },
      with: { profile: true },
    });

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
      note: 'Same site, one proposal.',
    });
    const result = await run();

    expect(adminRow?.profile?.name).toBeTruthy();
    expect(result).toEqual({
      ok: true,
      notification: {
        sourceProposalName: 'Community Garden Revamp',
        sourceProposalProfileId: source.profileId,
        targetProposalName: 'Neighbourhood Green Spaces',
        targetProposalProfileId: target.profileId,
        processTitle: setup.instance.instance.name,
        processProfileSlug: setup.instance.slug,
        note: {
          body: 'Same site, one proposal.',
          authorName: adminRow?.profile?.name ?? null,
        },
        sourceRecipients: [{ email: ada.email }],
        targetRecipients: [{ email: grace.email }],
      },
    });
    expect(JSON.stringify(result)).not.toContain(staleAda);
    expect(JSON.stringify(result)).not.toContain(staleGrace);
  });

  it('reads as no note when the admin left none', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: { note: null },
    });
  });

  // An admin can unmerge inside the debounce window.
  it('sends nothing when the edge is no longer live', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });
    await db
      .update(proposalRelationships)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposalRelationships.sourceProposalId, source.id));

    await expect(run()).resolves.toEqual({ ok: false, reason: 'edgeNotLive' });
  });

  for (const [label, side, column] of [
    ['the source was deleted', 'source', 'deletedAt'],
    ['the source was moderation-detached', 'source', 'moderationDetachedAt'],
    ['the target was deleted', 'target', 'deletedAt'],
    ['the target was moderation-detached', 'target', 'moderationDetachedAt'],
  ] as const) {
    it(`sends nothing when ${label}`, async ({ task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { ada, grace, createProposal, merge } =
        await createMergeSetup(testData);
      const [source, target] = await Promise.all([
        createProposal(ada.email, 'Source'),
        createProposal(grace.email, 'Target'),
      ]);

      const run = await merge({
        sourceProposalId: source.id,
        targetProposalId: target.id,
      });
      await db
        .update(proposals)
        .set({ [column]: new Date().toISOString() })
        .where(eq(proposals.id, side === 'source' ? source.id : target.id));

      await expect(run()).resolves.toEqual({
        ok: false,
        reason: 'proposalUnavailable',
      });
    });
  }

  it('drops the admin who performed the merge from both sides', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, admin, ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(setup.userEmail, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);
    await Promise.all([
      addCollaborator({
        profileId: source.profileId,
        authUserId: ada.authUserId,
        email: ada.email,
      }),
      addCollaborator({
        profileId: target.profileId,
        authUserId: admin.id,
        email: setup.userEmail,
      }),
    ]);

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: ada.email }],
        targetRecipients: [{ email: grace.email }],
      },
    });
  });

  it('tells someone on both proposals only that theirs was merged away', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);
    // Written at a different time than the source row, with a snapshot that
    // no longer matches — identity, not address, must carry the exclusion.
    await addCollaborator({
      profileId: target.profileId,
      authUserId: ada.authUserId,
      email: `older-${ada.email}`,
    });

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: ada.email }],
        targetRecipients: [{ email: grace.email }],
      },
    });
  });

  it('deduplicates across sides by address, not just by account', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);
    // A second account that signs in with the same inbox, differently cased.
    // auth.users' unique index is case-sensitive, so both rows can exist.
    const twin = await testData.createMemberUser({
      organization: setup.organization,
    });
    await db
      .update(authUsers)
      .set({ email: ada.email.toUpperCase() })
      .where(eq(authUsers.id, twin.authUserId));
    await addCollaborator({
      profileId: target.profileId,
      authUserId: twin.authUserId,
      email: twin.email,
    });

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: ada.email }],
        targetRecipients: [{ email: grace.email }],
      },
    });
  });

  // Anonymous accounts carry no address in auth.users, so they stay in the
  // audience and drop out at the address filter rather than earlier.
  it('skips a collaborator with no account address', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);
    const anonymous = await testData.createMemberUser({
      organization: setup.organization,
    });
    await db
      .update(authUsers)
      .set({ email: null, isAnonymous: true })
      .where(eq(authUsers.id, anonymous.authUserId));
    // The snapshot still holds whatever they signed up with.
    await addCollaborator({
      profileId: source.profileId,
      authUserId: anonymous.authUserId,
      email: anonymous.email,
    });

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: ada.email }],
        targetRecipients: [{ email: grace.email }],
      },
    });
  });

  it('reports no recipients only when neither side is addressable', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, createProposal, merge } = await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(setup.userEmail, 'Source'),
      createProposal(setup.userEmail, 'Target'),
    ]);

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });

  it('still writes to the surviving side when the merged proposal has no addresses', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(setup.userEmail, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [],
        targetRecipients: [{ email: grace.email }],
      },
    });
  });

  it('keeps the note when the admin has no resolvable profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { admin, ada, grace, createProposal, merge } =
      await createMergeSetup(testData);
    const [source, target] = await Promise.all([
      createProposal(ada.email, 'Source'),
      createProposal(grace.email, 'Target'),
    ]);

    const run = await merge({
      sourceProposalId: source.id,
      targetProposalId: target.id,
      note: 'Consolidated.',
    });
    await db
      .update(users)
      .set({ profileId: null })
      .where(eq(users.authUserId, admin.id));

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: { note: { body: 'Consolidated.', authorName: null } },
    });
  });
});
