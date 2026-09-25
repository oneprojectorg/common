import { createDecisionRole } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  ProposalStatus,
  Visibility,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

describe.concurrent('decision.listAssignableProposals', () => {
  it('reports the reviewer assignment on the row, whatever the caller has read', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const assigned = await testData.createReviewAssignment({
      title: `Assigned proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = assigned.context;
    const free = await testData.createReviewAssignment({
      context,
      title: `Free proposal ${task.id}`,
      reviewer: await testData.createInstanceReviewerWithRole(context),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listAssignableProposals({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    const assignedRow = result.items.find(
      (row) => row.id === assigned.proposal.id,
    );
    const freeRow = result.items.find((row) => row.id === free.proposal.id);

    expect(assignedRow?.assignment).toEqual({
      id: assigned.assignment.id,
      status: ProposalReviewAssignmentStatus.PENDING,
      reviewState: null,
    });
    expect(freeRow?.assignment).toBeNull();
    expect(assignedRow?.profileName).toBe(`Assigned proposal ${task.id}`);
  });

  it('reports a started review with its non-pending status and review state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const started = await testData.createReviewAssignment({
      title: `Started proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    const context = started.context;

    await db.insert(proposalReviews).values({
      assignmentId: started.assignment.id,
      reviewData: {},
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listAssignableProposals({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    const startedRow = result.items.find(
      (row) => row.id === started.proposal.id,
    );

    expect(startedRow?.assignment).toEqual({
      id: started.assignment.id,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      reviewState: ProposalReviewState.DRAFT,
    });
  });

  it("flags the reviewer's own proposal rather than hiding it", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Someone else's proposal ${task.id}`,
    });
    const context = created.context;

    const otherReviewer =
      await testData.createInstanceReviewerWithRole(context);
    const own = await testData.createReviewAssignment({
      context,
      title: `Reviewer's own proposal ${task.id}`,
      author: context.defaultReviewer,
      reviewer: otherReviewer,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listAssignableProposals({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    const ownRow = result.items.find((row) => row.id === own.proposal.id);
    const otherRow = result.items.find((row) => row.id === created.proposal.id);

    expect(ownRow?.isOwn).toBe(true);
    expect(ownRow?.assignment).toBeNull();
    expect(otherRow?.isOwn).toBe(false);
  });

  it('omits drafts, which the assignment pool never contains', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const instanceId = context.instance.instance.id;

    // Authored before the fixture advances to review.
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const draft = await decisions.createProposal({
      userEmail: context.defaultReviewer.email,
      processInstanceId: instanceId,
      proposalData: { title: `Draft proposal ${task.id}` },
      seedCollabDoc: true,
    });

    const created = await testData.createReviewAssignment({
      context,
      title: `Submitted proposal ${task.id}`,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listAssignableProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.items.map((row) => row.id)).not.toContain(draft.id);
    expect(result.items.map((row) => row.id)).toContain(created.proposal.id);
  });

  it('omits a rejected proposal, which the assignment pool also excludes', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const instanceId = context.instance.instance.id;

    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const rejected = await decisions.createProposal({
      userEmail: context.defaultReviewer.email,
      processInstanceId: instanceId,
      proposalData: { title: `Rejected proposal ${task.id}` },
      status: ProposalStatus.REJECTED,
      seedCollabDoc: true,
    });

    const created = await testData.createReviewAssignment({
      context,
      title: `Live proposal ${task.id}`,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listAssignableProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.items.map((row) => row.id)).not.toContain(rejected.id);
    expect(result.items.map((row) => row.id)).toContain(created.proposal.id);
  });

  it('lists a hidden proposal to a decisions admin who is not a profile admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const hidden = await testData.createReviewAssignment({
      title: `Hidden proposal ${task.id}`,
    });
    const context = hidden.context;

    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, hidden.proposal.id));

    const decisionsAdminRole = await createDecisionRole({
      name: `Decisions admin ${task.id}`,
      profileId: context.instance.profileId,
      permissions: {
        decisions: {
          type: 'decision',
          value: {
            create: false,
            read: true,
            update: false,
            delete: false,
            admin: true,
            inviteMembers: false,
            review: false,
            submitProposals: false,
            vote: false,
          },
        },
      },
    });
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const decisionsAdmin = await decisions.createMemberUser({
      organization: context.organization,
      instanceProfileIds: [context.instance.profileId],
      roleIds: { [context.instance.profileId]: decisionsAdminRole.id },
    });

    const caller = await createAuthenticatedCaller(decisionsAdmin.email);

    const result = await caller.decision.listAssignableProposals({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.items.map((row) => row.id)).toContain(hidden.proposal.id);
  });

  it('filters by title search', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const match = await testData.createReviewAssignment({
      title: `Riverbank restoration ${task.id}`,
    });
    const context = match.context;
    const other = await testData.createReviewAssignment({
      context,
      title: `Library hours ${task.id}`,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listAssignableProposals({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
      search: 'riverbank',
    });

    expect(result.items.map((row) => row.id)).toEqual([match.proposal.id]);
    expect(result.items.map((row) => row.id)).not.toContain(other.proposal.id);
  });

  it('pages without repeating or skipping a row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: `Paged proposal A ${task.id}`,
    });
    const context = first.context;
    const second = await testData.createReviewAssignment({
      context,
      title: `Paged proposal B ${task.id}`,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
      limit: 1,
    };

    const page1 = await adminCaller.decision.listAssignableProposals(input);
    expect(page1.items).toHaveLength(1);
    expect(page1.next).not.toBeNull();

    const page2 = await adminCaller.decision.listAssignableProposals({
      ...input,
      cursor: page1.next,
    });
    expect(page2.items).toHaveLength(1);

    expect(page2.next).toBeNull();

    const ids = [...page1.items, ...page2.items].map((row) => row.id);
    expect(ids).toEqual([second.proposal.id, first.proposal.id]);
  });

  it('rejects a phaseId the instance does not have', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.listAssignableProposals({
        processInstanceId: context.instance.instance.id,
        phaseId: 'not-a-phase',
        reviewerProfileId: context.defaultReviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeDecisionAccessTierGating('decision.listAssignableProposals', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listAssignableProposals({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.listAssignableProposals({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listAssignableProposals({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      const result = await caller.decision.listAssignableProposals({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: context.defaultReviewer.profileId,
      });

      expect(result.items).toEqual([]);
      expect(result.next).toBeNull();
    },
  ),
});
