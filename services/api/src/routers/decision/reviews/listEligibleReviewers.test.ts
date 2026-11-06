import { createDecisionRole } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** A "Reviewer" role on the decision profile with only the REVIEW bit set. */
async function createReviewerRole(instanceProfileId: string) {
  return createDecisionRole({
    name: 'Reviewer',
    profileId: instanceProfileId,
    permissions: {
      decisions: {
        type: 'decision',
        value: {
          create: false,
          read: true,
          update: false,
          delete: false,
          admin: false,
          inviteMembers: false,
          review: true,
          submitProposals: false,
          vote: false,
        },
      },
    },
  });
}

describe.concurrent('listEligibleReviewers', () => {
  it('returns role-holders (incl. the admin) and excludes non-reviewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const instanceProfileId = setup.instance.profileId;

    const [creator] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, setup.user.id));

    const reviewerRole = await createReviewerRole(instanceProfileId);

    // reviewerA holds the REVIEW bit; memberC is a plain member without it.
    const [reviewerA, memberC] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instanceProfileId],
        roleIds: { [instanceProfileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instanceProfileId],
      }),
    ]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.decision.listEligibleReviewers({
      processInstanceId: instanceId,
    });

    const ids = result.items.map((r) => r.id);

    // The admin's default decision role carries REVIEW, so the creator is
    // eligible too.
    expect(ids).toContain(creator!.profileId);
    expect(ids).toContain(reviewerA.profileId);
    // A member without the REVIEW capability must never surface as a candidate.
    expect(ids).not.toContain(memberC.profileId);

    // Display shape: purpose-built picker fields are present.
    const entry = result.items.find((r) => r.id === reviewerA.profileId);
    expect(entry).toMatchObject({
      id: reviewerA.profileId,
      name: expect.any(String),
      slug: expect.any(String),
    });
    expect(entry).toHaveProperty('avatarImageId');
    expect(entry).toHaveProperty('contact');
  });

  it('shows the login email or phone as contact, never the profile email', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const instanceProfileId = setup.instance.profileId;

    const reviewerRole = await createReviewerRole(instanceProfileId);
    const [emailReviewer, phoneReviewer, anonymousReviewer] = await Promise.all(
      [0, 1, 2].map(() =>
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instanceProfileId],
          roleIds: { [instanceProfileId]: reviewerRole.id },
        }),
      ),
    );
    if (!emailReviewer || !phoneReviewer || !anonymousReviewer) {
      throw new Error('Failed to create the reviewers');
    }

    const phoneDigits = `1555${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
    await Promise.all([
      db
        .update(profiles)
        .set({ email: `typo-${task.id.slice(0, 8)}@exmaple.org` })
        .where(eq(profiles.id, emailReviewer.profileId)),
      db
        .update(authUsers)
        .set({ email: null, phone: phoneDigits })
        .where(eq(authUsers.id, phoneReviewer.authUserId)),
      db
        .update(authUsers)
        .set({ email: null, phone: null, isAnonymous: true })
        .where(eq(authUsers.id, anonymousReviewer.authUserId)),
    ]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.listEligibleReviewers({
      processInstanceId: instanceId,
    });
    const contactById = new Map(
      result.items.map((reviewer) => [reviewer.id, reviewer.contact]),
    );

    expect(contactById.get(emailReviewer.profileId)).toEqual({
      type: 'email',
      email: emailReviewer.email,
    });
    expect(contactById.get(phoneReviewer.profileId)).toEqual({
      type: 'phone',
      phone: `+${phoneDigits}`,
    });
    expect(contactById.has(anonymousReviewer.profileId)).toBe(true);
    expect(contactById.get(anonymousReviewer.profileId)).toBeNull();
  });

  it('filters candidates by the search term', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const instanceProfileId = setup.instance.profileId;

    const reviewerRole = await createReviewerRole(instanceProfileId);
    const reviewerA = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instanceProfileId],
      roleIds: { [instanceProfileId]: reviewerRole.id },
    });

    const [reviewerProfile] = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, reviewerA.profileId));
    const reviewerName = reviewerProfile!.name;

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const matched = await adminCaller.decision.listEligibleReviewers({
      processInstanceId: instanceId,
      search: reviewerName,
    });
    expect(matched.items.map((r) => r.id)).toContain(reviewerA.profileId);

    // A term that matches no name excludes the reviewer (and yields no rows).
    const unmatched = await adminCaller.decision.listEligibleReviewers({
      processInstanceId: instanceId,
      search: 'zzz-no-such-reviewer-name',
    });
    expect(unmatched.items.map((r) => r.id)).not.toContain(reviewerA.profileId);
  });

  it('rejects non-admin callers', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    // Member has READ but no ADMIN on the instance profile.
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listEligibleReviewers({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
